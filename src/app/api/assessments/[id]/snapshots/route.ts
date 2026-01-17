import { NextResponse } from "next/server";
import { z } from "zod";
import { AuditAction, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent } from "@/lib/audit/log";
import { createAssessmentSnapshot } from "@/lib/assessment-release";

const payloadSchema = z.object({
  label: z.string().trim().min(1).max(80).optional()
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, organizationId: true }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const snapshots = await prisma.assessmentSnapshot.findMany({
    where: { assessmentId: assessment.id },
    orderBy: { createdAt: "desc" },
    include: { createdByUser: { select: { name: true, email: true } } }
  });

  return NextResponse.json({
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      type: snapshot.type,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
      createdBy: snapshot.createdByUser
        ? { name: snapshot.createdByUser.name, email: snapshot.createdByUser.email }
        : null,
      releaseId: snapshot.releaseId
    }))
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse({ label: body?.label });
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos", issues: parsed.error.issues }, { status: 400 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, organizationId: true }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const snapshotRecord = await createAssessmentSnapshot({
    assessmentId: assessment.id,
    type: "MANUAL",
    label: parsed.data.label ?? null,
    createdByUserId: session.user.id
  });

  await logAuditEvent({
    action: AuditAction.CREATE,
    entityType: "AssessmentSnapshot",
    entityId: snapshotRecord.id,
    organizationId: assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: {
      assessmentId: assessment.id,
      type: "MANUAL",
      label: parsed.data.label ?? null
    }
  });

  return NextResponse.json({
    success: true,
    snapshot: {
      id: snapshotRecord.id,
      type: snapshotRecord.type,
      label: snapshotRecord.label,
      createdAt: snapshotRecord.createdAt
    }
  });
}
