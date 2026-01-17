"use server";

import { AuditAction, CisStatus, EditingMode, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent, logFieldChanges } from "@/lib/audit/log";
import { isReleaseLocked } from "@/lib/assessment-release";
import { canEditAssessment } from "@/lib/assessment-editing";

const overrideSchema = z.object({
  assessmentId: z.string().min(1),
  cisSafeguardId: z.string().min(1),
  manualOverride: z.boolean(),
  manualStatus: z.nativeEnum(CisStatus).optional(),
  manualMaturityLevel: z.coerce.number().min(0).max(3).optional(),
  reason: z.string().optional()
});

export async function updateCisOverride(formData: FormData) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return { error: "Nao autorizado" };
  }

  const manualOverride = formData.get("manualOverride") === "true";
  const parsed = overrideSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    cisSafeguardId: formData.get("cisSafeguardId"),
    manualOverride,
    manualStatus: formData.get("manualStatus"),
    manualMaturityLevel: formData.get("manualMaturityLevel"),
    reason: formData.get("reason")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  if (parsed.data.manualOverride && (!parsed.data.manualStatus || parsed.data.manualMaturityLevel === undefined)) {
    return { error: "Informe status e maturidade" };
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: parsed.data.assessmentId, deletedAt: null },
    select: { id: true, organizationId: true, editingMode: true }
  });

  if (!assessment) {
    return { error: "Assessment nao encontrado" };
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return { error: "Sem acesso a organizacao" };
  }

  const release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: assessment.id },
    orderBy: { createdAt: "desc" }
  });
  const releaseStatus = release?.status ?? null;
  const canEdit = canEditAssessment({
    role: session.user.role,
    releaseStatus,
    editingMode: assessment.editingMode
  });
  if (!canEdit) {
    await logAuditEvent({
      action: AuditAction.OTHER,
      entityType: "Assessment",
      entityId: assessment.id,
      fieldName: "editingMode",
      oldValue: assessment.editingMode,
      newValue: assessment.editingMode,
      organizationId: assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext: getRequestContext(),
      success: false,
      errorMessage: "Editing locked"
    });
    return { error: "Assessment bloqueado para edicao" };
  }

  const isAdminOverride =
    session.user.role === Role.ADMIN &&
    (isReleaseLocked(releaseStatus) || assessment.editingMode === EditingMode.LOCKED_ADMIN_ONLY);

  const safeguard = await prisma.cisSafeguard.findUnique({
    where: { id: parsed.data.cisSafeguardId },
    select: { id: true, controlId: true }
  });

  if (!safeguard) {
    return { error: "Salvaguarda nao encontrada" };
  }

  const existingResult = await prisma.assessmentCisResult.findUnique({
    where: {
      assessmentId_cisControlId_cisSafeguardId: {
        assessmentId: assessment.id,
        cisControlId: safeguard.controlId,
        cisSafeguardId: safeguard.id
      }
    }
  });

  const updated = await prisma.assessmentCisResult.upsert({
    where: {
      assessmentId_cisControlId_cisSafeguardId: {
        assessmentId: assessment.id,
        cisControlId: safeguard.controlId,
        cisSafeguardId: safeguard.id
      }
    },
    update: {
      manualOverride: parsed.data.manualOverride,
      manualStatus: parsed.data.manualOverride ? parsed.data.manualStatus : null,
      manualMaturityLevel: parsed.data.manualOverride ? parsed.data.manualMaturityLevel : null,
      updatedById: session.user.id
    },
    create: {
      assessmentId: assessment.id,
      cisControlId: safeguard.controlId,
      cisSafeguardId: safeguard.id,
      derivedFromSsdf: false,
      manualOverride: parsed.data.manualOverride,
      manualStatus: parsed.data.manualOverride ? parsed.data.manualStatus : null,
      manualMaturityLevel: parsed.data.manualOverride ? parsed.data.manualMaturityLevel : null,
      updatedById: session.user.id
    }
  });

  const before = existingResult
    ? {
        manualOverride: existingResult.manualOverride,
        manualStatus: existingResult.manualStatus,
        manualMaturityLevel: existingResult.manualMaturityLevel
      }
    : { manualOverride: false, manualStatus: null, manualMaturityLevel: null };

  const after = {
    manualOverride: updated.manualOverride,
    manualStatus: updated.manualStatus,
    manualMaturityLevel: updated.manualMaturityLevel
  };

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "AssessmentCisResult",
    entityId: updated.id,
    organizationId: assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext(),
    before,
    after,
    fields: ["manualOverride", "manualStatus", "manualMaturityLevel"],
    metadata: isAdminOverride ? { override: true, reason: parsed.data.reason } : undefined
  });

  if (isAdminOverride) {
    await logAuditEvent({
      action: AuditAction.UPDATE,
      entityType: "Assessment",
      entityId: assessment.id,
      fieldName: "editingOverride",
      oldValue: release?.status ?? null,
      newValue: "OVERRIDE",
      organizationId: assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext: getRequestContext(),
      metadata: parsed.data.reason ? { reason: parsed.data.reason } : { override: true }
    });
  }

  revalidatePath("/cis");
  revalidatePath("/compare");

  return { success: true };
}
