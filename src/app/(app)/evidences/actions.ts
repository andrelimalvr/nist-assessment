"use server";

import { EvidenceType, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const evidenceSchema = z.object({
  responseId: z.string().min(1),
  description: z.string().min(1),
  type: z.nativeEnum(EvidenceType),
  link: z.string().optional(),
  owner: z.string().optional(),
  date: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional()
});

export async function createEvidence(formData: FormData) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const parsed = evidenceSchema.safeParse({
    responseId: formData.get("responseId"),
    description: formData.get("description"),
    type: formData.get("type"),
    link: formData.get("link"),
    owner: formData.get("owner"),
    date: formData.get("date"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const evidence = await prisma.evidence.create({
    data: {
      responseId: parsed.data.responseId,
      description: parsed.data.description,
      type: parsed.data.type,
      link: parsed.data.link || null,
      owner: parsed.data.owner || null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      notes: parsed.data.notes || null
    }
  });

  const afterJson = JSON.parse(JSON.stringify(evidence));

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "Evidence",
      entityId: evidence.id,
      action: "create",
      after: afterJson
    }
  });

  revalidatePath("/evidences");

  return { success: true };
}
