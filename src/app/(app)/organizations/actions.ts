"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export async function createOrganization(formData: FormData) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const name = String(formData.get("name") || "").trim();
  if (!name) {
    return { error: "Nome obrigatorio" };
  }

  await prisma.organization.create({
    data: {
      name
    }
  });

  revalidatePath("/organizations");
  revalidatePath("/assessments");

  return { success: true };
}
