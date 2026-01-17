"use server";

import { AssessmentReleaseStatus, DgLevel, Role, SsdfStatus } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { recalculateCisForAssessment } from "@/lib/cis/replication";

const assessmentSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  scope: z.string().min(1),
  assessmentOwner: z.string().min(1),
  dgLevel: z.nativeEnum(DgLevel),
  startDate: z.string().min(1),
  reviewDate: z.string().optional(),
  notes: z.string().optional()
});

export async function createAssessment(formData: FormData) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const parsed = assessmentSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    unit: formData.get("unit"),
    scope: formData.get("scope"),
    assessmentOwner: formData.get("assessmentOwner"),
    dgLevel: formData.get("dgLevel"),
    startDate: formData.get("startDate"),
    reviewDate: formData.get("reviewDate"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const hasAccess = await ensureOrganizationAccess(session, parsed.data.organizationId);
  if (!hasAccess) {
    return { error: "Sem acesso a organizacao selecionada" };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { deletedAt: true }
  });

  if (!organization || organization.deletedAt) {
    return { error: "Organizacao nao encontrada" };
  }

  const assessment = await prisma.assessment.create({
    data: {
      organizationId: parsed.data.organizationId,
      name: parsed.data.name,
      unit: parsed.data.unit,
      scope: parsed.data.scope,
      assessmentOwner: parsed.data.assessmentOwner,
      dgLevel: parsed.data.dgLevel,
      startDate: new Date(parsed.data.startDate),
      reviewDate: parsed.data.reviewDate ? new Date(parsed.data.reviewDate) : null,
      notes: parsed.data.notes || null,
      createdById: session.user.id
    }
  });

  await prisma.assessmentRelease.create({
    data: {
      assessmentId: assessment.id,
      status: AssessmentReleaseStatus.DRAFT,
      createdByUserId: session.user.id
    }
  });

  const tasks = await prisma.ssdfTask.findMany({ select: { id: true } });
  if (tasks.length > 0) {
    await prisma.assessmentSsdfTaskResult.createMany({
      data: tasks.map((task) => ({
        assessmentId: assessment.id,
        ssdfTaskId: task.id,
        status: SsdfStatus.NOT_STARTED,
        maturityLevel: 0,
        targetLevel: 2,
        weight: 3
      }))
    });
  }

  await recalculateCisForAssessment(prisma, assessment.id, session.user.id);

  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  revalidatePath("/roadmap");
  revalidatePath("/evidences");
  revalidatePath("/cis");
  revalidatePath("/compare");

  return { success: true, assessmentId: assessment.id };
}
