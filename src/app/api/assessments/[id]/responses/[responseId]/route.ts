import { NextResponse } from "next/server";
import { z } from "zod";
import { AuditAction, Role, SsdfStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { parseEvidenceLinks } from "@/lib/ssdf";
import { recalculateCisForSsdfTask } from "@/lib/cis/replication";
import { getRequestContext } from "@/lib/audit/request";
import { logFieldChanges } from "@/lib/audit/log";

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
  comments: z.string().optional()
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
    include: { assessment: { select: { id: true, organizationId: true, deletedAt: true } } }
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

  await recalculateCisForSsdfTask(
    prisma,
    existing.assessmentId,
    existing.ssdfTaskId,
    session.user.id
  );

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
