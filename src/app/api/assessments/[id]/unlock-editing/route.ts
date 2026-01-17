import { NextResponse } from "next/server";
import { z } from "zod";
import { AssessmentReleaseStatus, AuditAction, EditingMode, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent } from "@/lib/audit/log";

const payloadSchema = z.object({
  note: z.string().optional()
});

export async function POST(
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
      editingMode: true
    }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const requestContext = { ...getRequestContext(), route: new URL(request.url).pathname };
  const latestRelease = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: assessment.id },
    orderBy: { createdAt: "desc" }
  });

  let release = latestRelease;
  let releaseAction: "created" | "reopened" | "existing" = "existing";
  let previousStatus = latestRelease?.status ?? AssessmentReleaseStatus.DRAFT;
  let baseReleaseId: string | null = null;

  if (!latestRelease) {
    release = await prisma.assessmentRelease.create({
      data: {
        assessmentId: assessment.id,
        status: AssessmentReleaseStatus.DRAFT,
        createdByUserId: session.user.id,
        notes: parsed.data.note || null
      }
    });
    releaseAction = "created";
  } else if (latestRelease.status === AssessmentReleaseStatus.APPROVED) {
    baseReleaseId = latestRelease.id;
    release = await prisma.assessmentRelease.create({
      data: {
        assessmentId: assessment.id,
        status: AssessmentReleaseStatus.DRAFT,
        createdByUserId: session.user.id,
        baseReleaseId,
        notes: parsed.data.note || null
      }
    });
    releaseAction = "created";
  } else if (latestRelease.status === AssessmentReleaseStatus.IN_REVIEW) {
    release = await prisma.assessmentRelease.update({
      where: { id: latestRelease.id },
      data: {
        status: AssessmentReleaseStatus.DRAFT,
        notes: parsed.data.note || null
      }
    });
    releaseAction = "reopened";
  }

  if (!release) {
    return NextResponse.json({ error: "Nao foi possivel liberar edicao" }, { status: 500 });
  }

  if (releaseAction === "created") {
    const [taskResultsCount, evidencesCount, cisResultsCount] = await Promise.all([
      prisma.assessmentSsdfTaskResult.count({ where: { assessmentId: assessment.id } }),
      prisma.evidence.count({ where: { ssdfResult: { assessmentId: assessment.id } } }),
      prisma.assessmentCisResult.count({ where: { assessmentId: assessment.id } })
    ]);

    await logAuditEvent({
      action: AuditAction.CREATE,
      entityType: "AssessmentRelease",
      entityId: release.id,
      fieldName: "status",
      oldValue: null,
      newValue: release.status,
      organizationId: assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext,
      metadata: {
        note: parsed.data.note || null,
        baseReleaseId,
        copiedCounts: {
          taskResults: taskResultsCount,
          evidences: evidencesCount,
          cisResults: cisResultsCount
        }
      }
    });
  }

  if (releaseAction === "reopened") {
    await logAuditEvent({
      action: AuditAction.UPDATE,
      entityType: "AssessmentRelease",
      entityId: release.id,
      fieldName: "status",
      oldValue: previousStatus,
      newValue: release.status,
      organizationId: assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext,
      metadata: parsed.data.note ? { note: parsed.data.note } : undefined
    });
  }

  const updatedAssessment = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      editingMode: EditingMode.UNLOCKED_FOR_ASSESSORS,
      editingLockedByUserId: null,
      editingLockedAt: null,
      editingLockNote: null
    }
  });

  if (assessment.editingMode !== updatedAssessment.editingMode) {
    await logAuditEvent({
      action: AuditAction.UPDATE,
      entityType: "Assessment",
      entityId: assessment.id,
      fieldName: "editingMode",
      oldValue: assessment.editingMode,
      newValue: updatedAssessment.editingMode,
      organizationId: assessment.organizationId,
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      requestContext,
      metadata: {
        note: parsed.data.note || null,
        releaseId: release.id
      }
    });
  }

  return NextResponse.json({
    success: true,
    releaseId: release.id,
    releaseStatus: release.status,
    editingMode: updatedAssessment.editingMode
  });
}
