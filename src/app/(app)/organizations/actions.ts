"use server";

import { AuditAction, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestContext } from "@/lib/audit/request";

export async function createOrganization(formData: FormData) {
  const session = await requireAuth([Role.ADMIN]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const name = String(formData.get("name") || "").trim();
  if (!name) {
    return { error: "Nome obrigatorio" };
  }

  const organization = await prisma.organization.create({
    data: {
      name
    }
  });

  await prisma.userOrganization.create({
    data: {
      userId: session.user.id,
      organizationId: organization.id
    }
  });

  await logAuditEvent({
    action: AuditAction.CREATE,
    entityType: "Organization",
    entityId: organization.id,
    fieldName: "name",
    oldValue: null,
    newValue: organization.name,
    organizationId: organization.id,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext()
  });

  revalidatePath("/organizations");
  revalidatePath("/assessments");

  return { success: true };
}
