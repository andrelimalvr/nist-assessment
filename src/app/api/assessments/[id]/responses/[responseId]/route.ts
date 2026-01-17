import { NextResponse } from "next/server";
import { z } from "zod";
import { AuditAction, EditingMode, Role, SsdfStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { isApplicable, parseEvidenceLinks } from "@/lib/ssdf";
import { recalculateCisForSsdfTask } from "@/lib/cis/replication";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent, logFieldChanges } from "@/lib/audit/log";
import { isReleaseLocked } from "@/lib/assessment-release";
import { logAssessmentTaskHistory } from "@/lib/history/log";
import { canEditAssessment } from "@/lib/assessment-editing";

const payloadSchema = z.object({
  status: z.nativeEnum(SsdfStatus),
  maturityLevel: z.number().min(0).max(3),
  targetLevel: z.number().min(0).max(3),
  weight: z.number().min(1).max(5),
  owner: z.string().optional(),
  team: z.string().optional(),
  dueDate: z.string().optional(),
  lastReview: z.string().optional(),
  evidenceText: z.string().optional(),
  evidenceLinks: z.union([z.string(), z.array(z.string())]).optional(),
  comments: z.string().optional(),
  reason: z.string().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; responseId: string } }
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

  const existing = await prisma.assessmentSsdfTaskResult.findUnique({
    where: { id: params.responseId },
    include: {
      assessment: { select: { id: true, organizationId: true, deletedAt: true, editingMode: true } }
    }
  });

  if (!existing || existing.assessmentId !== params.id || existing.assessment.deletedAt) {
    return NextResponse.json({ error: "Resposta nao encontrada" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(
    session,
    existing.assessment.organizationId
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: existing.assessmentId },
    orderBy: { createdAt: "desc" }
  });
  const releaseStatus = release?.status ?? null;
  const canEdit = canEditAssessment({
    role: session.user.role,
    releaseStatus,
    editingMode: existing.assessment.editingMode
  });
  if (!canEdit) {
    await logAuditEvent({
      action: AuditAction.OTHER,
      entityType: "Assessment",
      entityId: existing.assessmentId,
      fieldName: "editingMode",
      oldValue: existing.assessment.editingMode,
      newValue: existing.assessment.editingMode,
      organizationId: existing.assessment.organizationId,
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
      existing.assessment.editingMode === EditingMode.LOCKED_ADMIN_ONLY);

  const data = {
    status: parsed.data.status,
    maturityLevel: parsed.data.maturityLevel,
    targetLevel: parsed.data.targetLevel,
    weight: parsed.data.weight,
    owner: parsed.data.owner || null,
    team: parsed.data.team || null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    lastReview: parsed.data.lastReview ? new Date(parsed.data.lastReview) : null,
    evidenceText: parsed.data.evidenceText || null,
    evidenceLinks: parseEvidenceLinks(parsed.data.evidenceLinks),
    comments: parsed.data.comments || null,
    updatedById: session.user.id
  };

  const updated = await prisma.assessmentSsdfTaskResult.update({
    where: { id: params.responseId },
    data
  });

  if (isAdminOverride) {
    await logAuditEvent({
      action: AuditAction.UPDATE,
      entityType: "Assessment",
      entityId: existing.assessmentId,
      fieldName: "editingOverride",
      oldValue: release?.status ?? null,
      newValue: "OVERRIDE",
      organizationId: existing.assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
      metadata: parsed.data.reason ? { reason: parsed.data.reason } : { override: true }
    });
  }

  await recalculateCisForSsdfTask(
    prisma,
    existing.assessmentId,
    existing.ssdfTaskId,
    session.user.id
  );

  await logAssessmentTaskHistory({
    assessmentTaskResultId: params.responseId,
    changedByUserId: session.user.id,
    reason: parsed.data.reason || null,
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: isAdminOverride ? { override: true, releaseStatus: release?.status } : undefined,
    before: {
      status: existing.status,
      applicable: isApplicable(existing.status),
      maturityLevel: existing.maturityLevel,
      targetLevel: existing.targetLevel,
      weight: existing.weight,
      owner: existing.owner,
      team: existing.team,
      dueDate: existing.dueDate,
      lastReview: existing.lastReview,
      evidenceText: existing.evidenceText,
      evidenceLinks: existing.evidenceLinks,
      comments: existing.comments
    },
    after: {
      status: updated.status,
      applicable: isApplicable(updated.status),
      maturityLevel: updated.maturityLevel,
      targetLevel: updated.targetLevel,
      weight: updated.weight,
      owner: updated.owner,
      team: updated.team,
      dueDate: updated.dueDate,
      lastReview: updated.lastReview,
      evidenceText: updated.evidenceText,
      evidenceLinks: updated.evidenceLinks,
      comments: updated.comments
    },
    fields: [
      "status",
      "applicable",
      "maturityLevel",
      "targetLevel",
      "weight",
      "owner",
      "dueDate",
      "comments",
      "team",
      "lastReview",
      "evidenceText",
      "evidenceLinks"
    ]
  });

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "AssessmentSsdfTaskResult",
    entityId: params.responseId,
    organizationId: existing.assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    before: {
      status: existing.status,
      maturityLevel: existing.maturityLevel,
      targetLevel: existing.targetLevel,
      weight: existing.weight,
      owner: existing.owner,
      team: existing.team,
      dueDate: existing.dueDate,
      lastReview: existing.lastReview,
      evidenceText: existing.evidenceText,
      evidenceLinks: existing.evidenceLinks,
      comments: existing.comments
    },
    after: {
      status: updated.status,
      maturityLevel: updated.maturityLevel,
      targetLevel: updated.targetLevel,
      weight: updated.weight,
      owner: updated.owner,
      team: updated.team,
      dueDate: updated.dueDate,
      lastReview: updated.lastReview,
      evidenceText: updated.evidenceText,
      evidenceLinks: updated.evidenceLinks,
      comments: updated.comments
    },
    fields: [
      "status",
      "maturityLevel",
      "targetLevel",
      "weight",
      "owner",
      "team",
      "dueDate",
      "lastReview",
      "evidenceText",
      "evidenceLinks",
      "comments"
    ]
  });

  return NextResponse.json({ success: true });
}
