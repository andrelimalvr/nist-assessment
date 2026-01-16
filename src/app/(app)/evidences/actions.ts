"use server";

import { AuditAction, EvidenceType, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent } from "@/lib/audit/log";

const evidenceSchema = z.object({
  assessmentId: z.string().min(1),
  ssdfResultId: z.string().min(1),
  description: z.string().min(1),
  type: z.nativeEnum(EvidenceType),
  link: z.string().optional(),
  owner: z.string().optional(),
  date: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional()
});

export async function createEvidence(formData: FormData) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const parsed = evidenceSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    ssdfResultId: formData.get("ssdfResultId"),
    description: formData.get("description"),
    type: formData.get("type"),
    link: formData.get("link"),
    owner: formData.get("owner"),
    date: formData.get("date"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const ssdfResult = await prisma.assessmentSsdfTaskResult.findUnique({
    where: { id: parsed.data.ssdfResultId },
    include: { assessment: { select: { id: true, organizationId: true, deletedAt: true } } }
  });

  if (!ssdfResult || ssdfResult.assessmentId !== parsed.data.assessmentId || ssdfResult.assessment.deletedAt) {
    return { error: "Resposta nao encontrada" };
  }

  const hasAccess = await ensureOrganizationAccess(
    session,
    ssdfResult.assessment.organizationId
  );
  if (!hasAccess) {
    return { error: "Sem acesso a organizacao" };
  }

  const evidence = await prisma.evidence.create({
    data: {
      ssdfResultId: parsed.data.ssdfResultId,
      description: parsed.data.description,
      type: parsed.data.type,
      link: parsed.data.link || null,
      owner: parsed.data.owner || null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      notes: parsed.data.notes || null
    }
  });

  await logAuditEvent({
    action: AuditAction.CREATE,
    entityType: "Evidence",
    entityId: evidence.id,
    fieldName: "description",
    oldValue: null,
    newValue: evidence.description,
    organizationId: ssdfResult.assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext(),
    metadata: {
      type: evidence.type,
      ssdfResultId: evidence.ssdfResultId,
      link: evidence.link || null
    }
  });

  revalidatePath("/evidences");

  return { success: true };
}
