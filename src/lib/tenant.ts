import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export async function getAccessibleOrganizationIds(session: Session | null) {
  if (!session) return [];
  if (session.user.role === Role.ADMIN) return null;

  const memberships = await prisma.userOrganization.findMany({
    where: { userId: session.user.id, organization: { is: { deletedAt: null } } },
    select: { organizationId: true }
  });

  return memberships.map((membership) => membership.organizationId);
}

export async function ensureOrganizationAccess(
  session: Session | null,
  organizationId: string
) {
  if (!session) return false;
  if (session.user.role === Role.ADMIN) return true;

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
    include: { organization: true }
  });

  return Boolean(membership && !membership.organization.deletedAt);
}
