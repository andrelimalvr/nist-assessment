import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AuditAction, Role } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, logFieldChanges } from "@/lib/audit/log";
import { getRequestContext } from "@/lib/audit/request";

const payloadSchema = z.object({
  name: z.string().trim().min(3).max(100)
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

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse({ name: body?.name });
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos", issues: parsed.error.issues }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: params.id }
  });

  if (!organization || organization.deletedAt) {
    return NextResponse.json({ error: "Organizacao nao encontrada" }, { status: 404 });
  }

  const duplicate = await prisma.organization.findFirst({
    where: {
      id: { not: organization.id },
      deletedAt: null,
      name: { equals: parsed.data.name, mode: "insensitive" }
    },
    select: { id: true }
  });

  if (duplicate) {
    return NextResponse.json(
      { error: "Ja existe uma organizacao com esse nome" },
      { status: 400 }
    );
  }

  const updated = await prisma.organization.update({
    where: { id: organization.id },
    data: { name: parsed.data.name }
  });

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "Organization",
    entityId: updated.id,
    organizationId: updated.id,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    before: { name: organization.name },
    after: { name: updated.name },
    fields: ["name"],
    metadata: { editedFrom: "organizations_table_modal" }
  });

  return NextResponse.json({ success: true, organization: updated });
}
