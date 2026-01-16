"use server";

import { Role, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const assessmentSchema = z.object({
  organizationId: z.string().min(1),
  unit: z.string().min(1),
  scope: z.string().min(1),
  assessmentOwner: z.string().min(1),
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
    unit: formData.get("unit"),
    scope: formData.get("scope"),
    assessmentOwner: formData.get("assessmentOwner"),
    startDate: formData.get("startDate"),
    reviewDate: formData.get("reviewDate"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const assessment = await prisma.assessment.create({
    data: {
      organizationId: parsed.data.organizationId,
      unit: parsed.data.unit,
      scope: parsed.data.scope,
      assessmentOwner: parsed.data.assessmentOwner,
      startDate: new Date(parsed.data.startDate),
      reviewDate: parsed.data.reviewDate ? new Date(parsed.data.reviewDate) : null,
      notes: parsed.data.notes || null,
      createdById: session.user.id
    }
  });

  const tasks = await prisma.ssdfTask.findMany({ select: { id: true } });
  if (tasks.length > 0) {
    await prisma.assessmentTaskResponse.createMany({
      data: tasks.map((task) => ({
        assessmentId: assessment.id,
        taskId: task.id,
        applicable: true,
        status: TaskStatus.NAO_INICIADO,
        maturity: 0,
        target: 3,
        weight: 3
      }))
    });
  }

  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  revalidatePath("/roadmap");
  revalidatePath("/evidences");

  return { success: true, assessmentId: assessment.id };
}
