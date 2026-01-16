"use server";

import { AuditAction, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { generateTemporaryPassword, getPasswordValidationError } from "@/lib/password";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent, logFieldChanges } from "@/lib/audit/log";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.nativeEnum(Role)
});

const accessSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role),
  organizationIds: z.array(z.string()).optional()
});

type CreateUserState = {
  success?: boolean;
  error?: string | null;
  tempPassword?: string | null;
  tempPasswordGenerated?: boolean;
};

export async function createUser(_: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const session = await requireAuth([Role.ADMIN]);
  if (!session) {
    return { error: "Nao autorizado" };
  }

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const rawPassword = String(formData.get("password") || "").trim();
  const tempPasswordGenerated = rawPassword.length === 0;
  const passwordToUse = tempPasswordGenerated ? generateTemporaryPassword() : rawPassword;

  const policyError = getPasswordValidationError(passwordToUse, parsed.data.email);
  if (policyError) {
    return { error: policyError };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { error: "Email ja cadastrado" };
  }

  const passwordHash = bcrypt.hashSync(passwordToUse, 10);
  const organizationIds = formData
    .getAll("organizationIds")
    .map((value) => String(value))
    .filter(Boolean);

  if (parsed.data.role !== Role.ADMIN && organizationIds.length === 0) {
    return { error: "Selecione ao menos uma organizacao" };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      mustChangePassword: true
    }
  });

  if (parsed.data.role !== Role.ADMIN && organizationIds.length > 0) {
    await prisma.userOrganization.createMany({
      data: organizationIds.map((organizationId) => ({
        userId: user.id,
        organizationId
      }))
    });
  }

  revalidatePath("/users");

  await logAuditEvent({
    action: AuditAction.CREATE,
    entityType: "User",
    entityId: user.id,
    fieldName: "email",
    oldValue: null,
    newValue: user.email,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext(),
    metadata: { role: user.role, tempPasswordGenerated }
  });

  return {
    success: true,
    tempPassword: tempPasswordGenerated ? passwordToUse : null,
    tempPasswordGenerated
  };
}

export async function updateUserAccess(formData: FormData) {
  const session = await requireAuth([Role.ADMIN]);
  if (!session) {
    return { error: "Nao autorizado" };
  }

  const organizationIds = formData
    .getAll("organizationIds")
    .map((value) => String(value))
    .filter(Boolean);

  const parsed = accessSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    organizationIds
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  if (parsed.data.role !== Role.ADMIN && (parsed.data.organizationIds?.length ?? 0) === 0) {
    return { error: "Selecione ao menos uma organizacao" };
  }

  const existing = await prisma.user.findFirst({
    where: { id: parsed.data.userId, deletedAt: null },
    include: { userOrganizations: true }
  });
  if (!existing) {
    return { error: "Usuario nao encontrado" };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role }
  });

  await prisma.userOrganization.deleteMany({
    where: { userId: parsed.data.userId }
  });

  if (parsed.data.role !== Role.ADMIN) {
    await prisma.userOrganization.createMany({
      data: (parsed.data.organizationIds ?? []).map((organizationId) => ({
        userId: parsed.data.userId,
        organizationId
      }))
    });
  }

  revalidatePath("/users");

  const beforeOrgIds = existing.userOrganizations.map((org) => org.organizationId).sort();
  const afterOrgIds = (parsed.data.organizationIds ?? []).slice().sort();

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "User",
    entityId: existing.id,
    organizationId: null,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext(),
    before: { role: existing.role, organizationIds: beforeOrgIds },
    after: { role: parsed.data.role, organizationIds: afterOrgIds },
    fields: ["role", "organizationIds"],
    metadata: { targetEmail: existing.email }
  });

  return { success: true };
}
