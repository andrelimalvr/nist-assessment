import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAuth(allowedRoles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role as Role)) {
    return null;
  }
  return session;
}

export function canEdit(role?: string | null) {
  return role === Role.ADMIN || role === Role.ASSESSOR;
}
