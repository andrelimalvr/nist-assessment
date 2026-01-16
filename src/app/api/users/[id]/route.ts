import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AuditAction, Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestContext } from "@/lib/audit/request";

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

  if (session.user.id === params.id) {
    return NextResponse.json(
      { error: "Voce nao pode excluir seu proprio usuario." },
      { status: 409 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    include: { userOrganizations: true }
  });

  if (!targetUser || targetUser.deletedAt) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (targetUser.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN, deletedAt: null }
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Nao e possivel excluir o ultimo administrador." },
        { status: 409 }
      );
    }
  }

  const removedOrganizationsCount = targetUser.userOrganizations.length;
  const now = new Date();

  await prisma.$transaction([
    prisma.userOrganization.deleteMany({ where: { userId: targetUser.id } }),
    prisma.user.update({
      where: { id: targetUser.id },
      data: { deletedAt: now }
    })
  ]);

  await logAuditEvent({
    action: AuditAction.DELETE,
    entityType: "User",
    entityId: targetUser.id,
    fieldName: "deletedAt",
    oldValue: null,
    newValue: now,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: {
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      removedOrganizationsCount
    }
  });

  return NextResponse.json({ success: true });
}
