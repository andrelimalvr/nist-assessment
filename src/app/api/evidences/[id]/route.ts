import { NextResponse } from "next/server";
import { z } from "zod";
import { AuditAction, EditingMode, EvidenceReviewStatus, EvidenceType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent, logFieldChanges } from "@/lib/audit/log";
import { isReleaseLocked } from "@/lib/assessment-release";
import { canEditAssessment } from "@/lib/assessment-editing";
import { logEvidenceHistory } from "@/lib/history/log";

const payloadSchema = z.object({
  description: z.string().min(1),
  type: z.nativeEnum(EvidenceType),
  reviewStatus: z.nativeEnum(EvidenceReviewStatus),
  link: z.string().optional(),
  owner: z.string().optional(),
  date: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const existing = await prisma.evidence.findUnique({
    where: { id: params.id },
    include: {
      ssdfResult: {
        include: {
          assessment: {
            select: { id: true, organizationId: true, deletedAt: true, editingMode: true }
          }
        }
      }
    }
  });

  if (!existing || existing.ssdfResult.assessment.deletedAt) {
    return NextResponse.json({ error: "Evidencia nao encontrada" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(
    session,
    existing.ssdfResult.assessment.organizationId
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: existing.ssdfResult.assessmentId },
    orderBy: { createdAt: "desc" }
  });
  const releaseStatus = release?.status ?? null;
  const canEdit = canEditAssessment({
    role: session.user.role,
    releaseStatus,
    editingMode: existing.ssdfResult.assessment.editingMode
  });
  if (!canEdit) {
    await logAuditEvent({
      action: AuditAction.OTHER,
      entityType: "Assessment",
      entityId: existing.ssdfResult.assessmentId,
      fieldName: "editingMode",
      oldValue: existing.ssdfResult.assessment.editingMode,
      newValue: existing.ssdfResult.assessment.editingMode,
      organizationId: existing.ssdfResult.assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
      success: false,
      errorMessage: "Editing locked"
    });
    return NextResponse.json({ error: "Assessment bloqueado para edicao" }, { status: 403 });
  }

  const isAdminOverride =
    session.user.role === Role.ADMIN &&
    (isReleaseLocked(releaseStatus) ||
      existing.ssdfResult.assessment.editingMode === EditingMode.LOCKED_ADMIN_ONLY);

  const updated = await prisma.evidence.update({
    where: { id: params.id },
    data: {
      description: parsed.data.description,
      type: parsed.data.type,
      reviewStatus: parsed.data.reviewStatus,
      link: parsed.data.link || null,
      owner: parsed.data.owner || null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      notes: parsed.data.notes || null
    }
  });

  await logEvidenceHistory({
    evidenceId: updated.id,
    changedByUserId: session.user.id,
    reason: parsed.data.reason || null,
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: isAdminOverride ? { override: true, releaseStatus: release?.status } : undefined,
    before: {
      type: existing.type,
      link: existing.link,
      validUntil: existing.validUntil,
      owner: existing.owner,
      reviewStatus: existing.reviewStatus,
      description: existing.description,
      notes: existing.notes,
      date: existing.date
    },
    after: {
      type: updated.type,
      link: updated.link,
      validUntil: updated.validUntil,
      owner: updated.owner,
      reviewStatus: updated.reviewStatus,
      description: updated.description,
      notes: updated.notes,
      date: updated.date
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

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "Evidence",
    entityId: updated.id,
    organizationId: existing.ssdfResult.assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    before: {
      type: existing.type,
      link: existing.link,
      validUntil: existing.validUntil,
      owner: existing.owner,
      reviewStatus: existing.reviewStatus,
      description: existing.description,
      notes: existing.notes,
      date: existing.date
    },
    after: {
      type: updated.type,
      link: updated.link,
      validUntil: updated.validUntil,
      owner: updated.owner,
      reviewStatus: updated.reviewStatus,
      description: updated.description,
      notes: updated.notes,
      date: updated.date
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
    ],
    metadata: isAdminOverride ? { override: true, reason: parsed.data.reason } : undefined
  });

  if (isAdminOverride) {
    await logAuditEvent({
      action: AuditAction.UPDATE,
      entityType: "Assessment",
      entityId: existing.ssdfResult.assessmentId,
      fieldName: "editingOverride",
      oldValue: release?.status ?? null,
      newValue: "OVERRIDE",
      organizationId: existing.ssdfResult.assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
      metadata: parsed.data.reason ? { reason: parsed.data.reason } : { override: true }
    });
  }

  return NextResponse.json({ success: true });
}
