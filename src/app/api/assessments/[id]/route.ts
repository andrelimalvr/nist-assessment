import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AuditAction, Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestContext } from "@/lib/audit/request";

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
