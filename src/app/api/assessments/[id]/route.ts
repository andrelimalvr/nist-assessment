import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { AssessmentReleaseStatus, AuditAction, DgLevel, Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestContext } from "@/lib/audit/request";
import { requireAuth } from "@/lib/rbac";
import { canEditAssessment } from "@/lib/assessment-editing";
import { logFieldChanges } from "@/lib/audit/log";

const payloadSchema = z
  .object({
    organizationId: z.string().min(1),
    name: z.string().min(3),
    unitArea: z.string().min(1),
    scope: z.string().min(1),
    ownerName: z.string().min(1),
    designGoal: z.nativeEnum(DgLevel),
    startDate: z.string().min(1),
    reviewDate: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Data de inicio invalida"
      });
    }

    if (data.reviewDate) {
      const review = new Date(data.reviewDate);
      if (Number.isNaN(review.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewDate"],
          message: "Data de revisao invalida"
        });
      } else if (!Number.isNaN(start.getTime()) && review < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewDate"],
          message: "Data de revisao deve ser igual ou posterior a data de inicio"
        });
      }
    }
  });

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { organization: true }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const [responsesCount, evidencesCount, mappingsCount] = await Promise.all([
    prisma.assessmentSsdfTaskResult.count({ where: { assessmentId: assessment.id } }),
    prisma.evidence.count({ where: { ssdfResult: { assessmentId: assessment.id } } }),
    prisma.assessmentCisResult.count({ where: { assessmentId: assessment.id } })
  ]);

  return NextResponse.json({
    id: assessment.id,
    assessmentName: assessment.name,
    organizationName: assessment.organization.name,
    responsesCount,
    evidencesCount,
    mappingsCount
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { organization: true }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const [responsesCount, evidencesCount, mappingsCount] = await Promise.all([
    prisma.assessmentSsdfTaskResult.count({ where: { assessmentId: assessment.id } }),
    prisma.evidence.count({ where: { ssdfResult: { assessmentId: assessment.id } } }),
    prisma.assessmentCisResult.count({ where: { assessmentId: assessment.id } })
  ]);

  const now = new Date();
  await prisma.assessment.update({
    where: { id: assessment.id },
    data: { deletedAt: now }
  });

  await logAuditEvent({
    action: AuditAction.DELETE,
    entityType: "Assessment",
    entityId: assessment.id,
    fieldName: "deletedAt",
    oldValue: null,
    newValue: now,
    organizationId: assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: {
      assessmentName: assessment.name,
      orgName: assessment.organization.name,
      counts: {
        responses: responsesCount,
        evidences: evidencesCount,
        mappings: mappingsCount
      }
    }
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse({
    organizationId: body.organizationId,
    name: body.name,
    unitArea: body.unitArea,
    scope: body.scope,
    ownerName: body.ownerName,
    designGoal: body.designGoal,
    startDate: body.startDate,
    reviewDate: body.reviewDate || undefined,
    notes: body.notes || undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos", issues: parsed.error.issues }, { status: 400 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      name: true,
      unit: true,
      scope: true,
      assessmentOwner: true,
      dgLevel: true,
      startDate: true,
      reviewDate: true,
      notes: true,
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

  if (session.user.role !== Role.ADMIN) {
    const release = await prisma.assessmentRelease.findFirst({
      where: { assessmentId: assessment.id },
      orderBy: { createdAt: "desc" }
    });
    const releaseStatus = release?.status ?? AssessmentReleaseStatus.DRAFT;
    const canEdit = canEditAssessment({
      role: session.user.role,
      releaseStatus,
      editingMode: assessment.editingMode
    });
    if (!canEdit) {
      return NextResponse.json(
        { error: "Edicao bloqueada pelo admin ou pelo status de publicacao" },
        { status: 403 }
      );
    }
  }

  if (session.user.role !== Role.ADMIN && parsed.data.organizationId !== assessment.organizationId) {
    const canMove = await ensureOrganizationAccess(session, parsed.data.organizationId);
    if (!canMove) {
      return NextResponse.json({ error: "Sem acesso a nova organizacao" }, { status: 403 });
    }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { deletedAt: true }
  });
  if (!organization || organization.deletedAt) {
    return NextResponse.json({ error: "Organizacao invalida" }, { status: 400 });
  }

  const startDate = new Date(parsed.data.startDate);
  const reviewDate = parsed.data.reviewDate ? new Date(parsed.data.reviewDate) : null;

  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      organizationId: parsed.data.organizationId,
      name: parsed.data.name,
      unit: parsed.data.unitArea,
      scope: parsed.data.scope,
      assessmentOwner: parsed.data.ownerName,
      dgLevel: parsed.data.designGoal,
      startDate,
      reviewDate,
      notes: parsed.data.notes || null
    }
  });

  const before = {
    organizationId: assessment.organizationId,
    name: assessment.name,
    unitArea: assessment.unit,
    scope: assessment.scope,
    ownerName: assessment.assessmentOwner,
    designGoal: assessment.dgLevel,
    startDate: assessment.startDate.toISOString(),
    reviewDate: assessment.reviewDate ? assessment.reviewDate.toISOString() : null,
    notes: assessment.notes ?? null
  };

  const after = {
    organizationId: updated.organizationId,
    name: updated.name,
    unitArea: updated.unit,
    scope: updated.scope,
    ownerName: updated.assessmentOwner,
    designGoal: updated.dgLevel,
    startDate: updated.startDate.toISOString(),
    reviewDate: updated.reviewDate ? updated.reviewDate.toISOString() : null,
    notes: updated.notes ?? null
  };

  const metadata =
    assessment.organizationId !== updated.organizationId
      ? {
          editedFrom: "assessments_table_modal",
          oldOrganizationId: assessment.organizationId,
          newOrganizationId: updated.organizationId
        }
      : { editedFrom: "assessments_table_modal" };

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "Assessment",
    entityId: updated.id,
    organizationId: updated.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    before,
    after,
    fields: [
      "organizationId",
      "name",
      "unitArea",
      "scope",
      "ownerName",
      "designGoal",
      "startDate",
      "reviewDate",
      "notes"
    ],
    metadata
  });

  return NextResponse.json({ success: true, assessment: updated });
}
