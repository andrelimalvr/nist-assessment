import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const organization = await prisma.organization.findUnique({
    where: { id: params.id },
    include: { _count: { select: { assessments: true } } }
  });

  if (!organization || organization.deletedAt) {
    return NextResponse.json({ error: "Organizacao nao encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    id: organization.id,
    name: organization.name,
    assessmentCount: organization._count.assessments
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

  const organization = await prisma.organization.findUnique({
    where: { id: params.id },
    include: { _count: { select: { assessments: true } } }
  });

  if (!organization || organization.deletedAt) {
    return NextResponse.json({ error: "Organizacao nao encontrada" }, { status: 404 });
  }

  const now = new Date();
  await prisma.organization.update({
    where: { id: params.id },
    data: { deletedAt: now }
  });

  await logAuditEvent({
    action: "DELETE",
    entityType: "Organization",
    entityId: organization.id,
    fieldName: "deletedAt",
    oldValue: null,
    newValue: now,
    organizationId: organization.id,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname }
  });

  return NextResponse.json({
    success: true,
    assessmentCount: organization._count.assessments
  });
}
