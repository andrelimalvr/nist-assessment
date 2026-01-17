import { NextResponse } from "next/server";
import { z } from "zod";
import { AssessmentReleaseStatus, AuditAction, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent } from "@/lib/audit/log";
import { buildAssessmentSnapshot } from "@/lib/assessment-release";

const payloadSchema = z.object({
  action: z.enum(["submit", "approve", "reject"]),
  notes: z.string().optional()
});

export async function POST(
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

  let release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: assessment.id },
    orderBy: { createdAt: "desc" }
  });

  if (!release) {
    release = await prisma.assessmentRelease.create({
      data: {
        assessmentId: assessment.id,
        status: AssessmentReleaseStatus.DRAFT,
        createdByUserId: session.user.id
      }
    });
  }

  const isAdmin = session.user.role === Role.ADMIN;
  const action = parsed.data.action;

  let nextStatus: AssessmentReleaseStatus | null = null;
  if (action === "submit") {
    if (!isAdmin && session.user.role !== Role.ASSESSOR) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
    }
    if (release.status !== AssessmentReleaseStatus.DRAFT) {
      return NextResponse.json({ error: "Release nao esta em rascunho" }, { status: 409 });
    }
    nextStatus = AssessmentReleaseStatus.IN_REVIEW;
  }

  if (action === "approve") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Somente admin pode aprovar" }, { status: 403 });
    }
    if (release.status !== AssessmentReleaseStatus.IN_REVIEW) {
      return NextResponse.json({ error: "Release nao esta em revisao" }, { status: 409 });
    }
    nextStatus = AssessmentReleaseStatus.APPROVED;
  }

  if (action === "reject") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Somente admin pode rejeitar" }, { status: 403 });
    }
    if (release.status !== AssessmentReleaseStatus.IN_REVIEW) {
      return NextResponse.json({ error: "Release nao esta em revisao" }, { status: 409 });
    }
    nextStatus = AssessmentReleaseStatus.DRAFT;
  }

  if (!nextStatus) {
    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    status: nextStatus,
    notes: parsed.data.notes || null
  };

  if (nextStatus === AssessmentReleaseStatus.APPROVED) {
    updateData.approvedAt = new Date();
    updateData.approvedByUserId = session.user.id;
    updateData.snapshot = await buildAssessmentSnapshot(assessment.id);
  }

  if (nextStatus === AssessmentReleaseStatus.DRAFT) {
    updateData.approvedAt = null;
    updateData.approvedByUserId = null;
  }

  const updated = await prisma.assessmentRelease.update({
    where: { id: release.id },
    data: updateData
  });

  await logAuditEvent({
    action: AuditAction.UPDATE,
    entityType: "AssessmentRelease",
    entityId: updated.id,
    fieldName: "status",
    oldValue: release.status,
    newValue: updated.status,
    organizationId: assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: parsed.data.notes ? { notes: parsed.data.notes } : undefined
  });

  return NextResponse.json({ success: true, status: updated.status });
}
