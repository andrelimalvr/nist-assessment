"use server";

import { AuditAction, EditingMode, EvidenceReviewStatus, EvidenceType, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent } from "@/lib/audit/log";
import { isReleaseLocked } from "@/lib/assessment-release";
import { canEditAssessment } from "@/lib/assessment-editing";
import { logEvidenceHistory } from "@/lib/history/log";

const evidenceSchema = z.object({
  assessmentId: z.string().min(1),
  ssdfResultId: z.string().min(1),
  description: z.string().min(1),
  type: z.nativeEnum(EvidenceType),
  reviewStatus: z.nativeEnum(EvidenceReviewStatus).optional(),
  link: z.string().optional(),
  owner: z.string().optional(),
  date: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional()
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
    reviewStatus: formData.get("reviewStatus"),
    link: formData.get("link"),
    owner: formData.get("owner"),
    date: formData.get("date"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes"),
    reason: formData.get("reason")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const ssdfResult = await prisma.assessmentSsdfTaskResult.findUnique({
    where: { id: parsed.data.ssdfResultId },
    include: {
      assessment: { select: { id: true, organizationId: true, deletedAt: true, editingMode: true } }
    }
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

  const release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: ssdfResult.assessmentId },
    orderBy: { createdAt: "desc" }
  });
  const releaseStatus = release?.status ?? null;
  const canEdit = canEditAssessment({
    role: session.user.role,
    releaseStatus,
    editingMode: ssdfResult.assessment.editingMode
  });
  if (!canEdit) {
    await logAuditEvent({
      action: AuditAction.OTHER,
      entityType: "Assessment",
      entityId: ssdfResult.assessmentId,
      fieldName: "editingMode",
      oldValue: ssdfResult.assessment.editingMode,
      newValue: ssdfResult.assessment.editingMode,
      organizationId: ssdfResult.assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext: getRequestContext(),
      success: false,
      errorMessage: "Editing locked"
    });
    return { error: "Assessment bloqueado para edicao" };
  }

  const isAdminOverride =
    session.user.role === Role.ADMIN &&
    (isReleaseLocked(releaseStatus) ||
      ssdfResult.assessment.editingMode === EditingMode.LOCKED_ADMIN_ONLY);

  const evidence = await prisma.evidence.create({
    data: {
      ssdfResultId: parsed.data.ssdfResultId,
      description: parsed.data.description,
      type: parsed.data.type,
      reviewStatus: parsed.data.reviewStatus ?? EvidenceReviewStatus.PENDING,
      link: parsed.data.link || null,
      owner: parsed.data.owner || null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      notes: parsed.data.notes || null
    }
  });

  await logEvidenceHistory({
    evidenceId: evidence.id,
    changedByUserId: session.user.id,
    reason: parsed.data.reason || null,
    requestContext: getRequestContext(),
    metadata: isAdminOverride
      ? { override: true, releaseStatus: release?.status, action: "create" }
      : { action: "create" },
    before: {
      type: null,
      link: null,
      validUntil: null,
      owner: null,
      reviewStatus: null,
      description: null,
      notes: null,
      date: null
    },
    after: {
      type: evidence.type,
      link: evidence.link,
      validUntil: evidence.validUntil,
      owner: evidence.owner,
      reviewStatus: evidence.reviewStatus,
      description: evidence.description,
      notes: evidence.notes,
      date: evidence.date
    },
    fields: [
      "type",
      "link",
      "validUntil",
      "owner",
      "reviewStatus",
      "description",
      "notes",
      "date"
    ]
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
      link: evidence.link || null,
      override: isAdminOverride ? true : undefined
    }
  });

  revalidatePath("/evidences");

  return { success: true };
}
