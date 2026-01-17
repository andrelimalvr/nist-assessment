import { NextResponse } from "next/server";
import { z } from "zod";
import { AssessmentReleaseStatus, AuditAction, EditingMode, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent } from "@/lib/audit/log";

const payloadSchema = z.object({
  editingMode: z.nativeEnum(EditingMode),
  note: z.string().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth([Role.ADMIN]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      editingMode: true,
      editingLockedByUserId: true,
      editingLockedAt: true
    }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: assessment.id },
    orderBy: { createdAt: "desc" }
  });
  const releaseStatus = release?.status ?? AssessmentReleaseStatus.DRAFT;
  if (
    parsed.data.editingMode === EditingMode.UNLOCKED_FOR_ASSESSORS &&
    releaseStatus !== AssessmentReleaseStatus.DRAFT
  ) {
    return NextResponse.json(
      { error: "Assessment aprovado ou em revisao. Crie uma nova revisao para liberar edicao." },
      { status: 409 }
    );
  }

  const nextMode = parsed.data.editingMode;
  const isLocked = nextMode === EditingMode.LOCKED_ADMIN_ONLY;
  const lockedAt = isLocked ? new Date() : null;
  const lockedBy = isLocked ? session.user.id : null;

  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      editingMode: nextMode,
      editingLockedByUserId: lockedBy,
      editingLockedAt: lockedAt,
      editingLockNote: isLocked ? parsed.data.note || null : null
    }
  });

  await logAuditEvent({
    action: AuditAction.UPDATE,
    entityType: "Assessment",
    entityId: updated.id,
    fieldName: "editingMode",
    oldValue: assessment.editingMode,
    newValue: updated.editingMode,
    organizationId: assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: {
      note: parsed.data.note || null,
      lockedBy: lockedBy,
      lockedAt: lockedAt?.toISOString() ?? null
    }
  });

  return NextResponse.json({ success: true, editingMode: updated.editingMode });
}
