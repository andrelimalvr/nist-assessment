"use server";

import { AuditAction, MappingType, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { recalculateCisForSsdfTask } from "@/lib/cis/replication";
import { getRequestContext } from "@/lib/audit/request";
import { logAuditEvent, logFieldChanges } from "@/lib/audit/log";

const mappingSchema = z
  .object({
    ssdfTaskId: z.string().min(1),
    cisControlId: z.string().optional().nullable(),
    cisSafeguardId: z.string().optional().nullable(),
    mappingType: z.nativeEnum(MappingType),
    weight: z.coerce.number().min(0).max(1),
    notes: z.string().optional()
  })
  .refine((data) => data.cisControlId || data.cisSafeguardId, {
    message: "Selecione um Control ou Safeguard."
  });

async function recalcForTask(ssdfTaskId: string) {
  const assessments = await prisma.assessmentSsdfTaskResult.findMany({
    where: { ssdfTaskId, assessment: { is: { deletedAt: null } } },
    select: { assessmentId: true },
    distinct: ["assessmentId"]
  });

  for (const assessment of assessments) {
    await recalculateCisForSsdfTask(prisma, assessment.assessmentId, ssdfTaskId, null);
  }
}

export async function createMapping(formData: FormData) {
  const session = await requireAuth([Role.ADMIN]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const cisControlId = String(formData.get("cisControlId") || "").trim() || undefined;
  const cisSafeguardId = String(formData.get("cisSafeguardId") || "").trim() || undefined;

  const parsed = mappingSchema.safeParse({
    ssdfTaskId: String(formData.get("ssdfTaskId") || ""),
    cisControlId,
    cisSafeguardId,
    mappingType: formData.get("mappingType"),
    weight: formData.get("weight"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const mapping = await prisma.ssdfCisMapping.create({
    data: {
      ssdfTaskId: parsed.data.ssdfTaskId,
      cisControlId: parsed.data.cisControlId || null,
      cisSafeguardId: parsed.data.cisSafeguardId || null,
      mappingType: parsed.data.mappingType,
      weight: parsed.data.weight,
      notes: parsed.data.notes || null
    }
  });

  await logAuditEvent({
    action: AuditAction.CREATE,
    entityType: "Mapping",
    entityId: mapping.id,
    fieldName: "ssdfTaskId",
    oldValue: null,
    newValue: parsed.data.ssdfTaskId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext(),
    metadata: {
      cisControlId: parsed.data.cisControlId || null,
      cisSafeguardId: parsed.data.cisSafeguardId || null,
      mappingType: parsed.data.mappingType,
      weight: parsed.data.weight
    }
  });

  await recalcForTask(parsed.data.ssdfTaskId);

  revalidatePath("/mappings");
  revalidatePath("/cis");
  revalidatePath("/compare");

  return { success: true };
}

export async function updateMapping(formData: FormData) {
  const session = await requireAuth([Role.ADMIN]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const mappingId = String(formData.get("mappingId") || "");
  if (!mappingId) {
    return { error: "Mapping invalido" };
  }

  const cisControlId = String(formData.get("cisControlId") || "").trim() || undefined;
  const cisSafeguardId = String(formData.get("cisSafeguardId") || "").trim() || undefined;

  const parsed = mappingSchema.safeParse({
    ssdfTaskId: String(formData.get("ssdfTaskId") || ""),
    cisControlId,
    cisSafeguardId,
    mappingType: formData.get("mappingType"),
    weight: formData.get("weight"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  const existing = await prisma.ssdfCisMapping.findUnique({
    where: { id: mappingId }
  });

  if (!existing) {
    return { error: "Mapping nao encontrado" };
  }

  const updated = await prisma.ssdfCisMapping.update({
    where: { id: mappingId },
    data: {
      ssdfTaskId: parsed.data.ssdfTaskId,
      cisControlId: parsed.data.cisControlId || null,
      cisSafeguardId: parsed.data.cisSafeguardId || null,
      mappingType: parsed.data.mappingType,
      weight: parsed.data.weight,
      notes: parsed.data.notes || null
    }
  });

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "Mapping",
    entityId: updated.id,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext(),
    before: {
      ssdfTaskId: existing.ssdfTaskId,
      cisControlId: existing.cisControlId,
      cisSafeguardId: existing.cisSafeguardId,
      mappingType: existing.mappingType,
      weight: existing.weight,
      notes: existing.notes
    },
    after: {
      ssdfTaskId: updated.ssdfTaskId,
      cisControlId: updated.cisControlId,
      cisSafeguardId: updated.cisSafeguardId,
      mappingType: updated.mappingType,
      weight: updated.weight,
      notes: updated.notes
    },
    fields: ["ssdfTaskId", "cisControlId", "cisSafeguardId", "mappingType", "weight", "notes"]
  });

  const affectedTasks = new Set([existing.ssdfTaskId, updated.ssdfTaskId]);
  for (const taskId of affectedTasks) {
    await recalcForTask(taskId);
  }

  revalidatePath("/mappings");
  revalidatePath("/cis");
  revalidatePath("/compare");

  return { success: true };
}
