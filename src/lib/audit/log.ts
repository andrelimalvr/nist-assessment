import { AuditAction, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redactMetadata, redactValue } from "@/lib/audit/redact";
import { getRequestContext } from "@/lib/audit/request";

export type AuditActor = {
  id?: string | null;
  email?: string | null;
  role?: Role | null;
};

export type AuditRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  route?: string;
};

export type AuditEvent = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  organizationId?: string | null;
  success?: boolean;
  errorMessage?: string | null;
  actor?: AuditActor;
  metadata?: Record<string, unknown>;
  requestContext?: AuditRequestContext;
};

function mergeMetadata(
  metadata: Record<string, unknown>,
  requestContext?: AuditRequestContext
) {
  const base = { ...metadata };
  if (requestContext?.requestId) base.requestId = requestContext.requestId;
  if (requestContext?.ip) base.ip = requestContext.ip;
  if (requestContext?.userAgent) base.userAgent = requestContext.userAgent;
  if (requestContext?.route) base.route = requestContext.route;
  return base;
}

export async function logAuditEvent(event: AuditEvent) {
  const context = event.requestContext ?? getRequestContext();
  const metadata = mergeMetadata(event.metadata ?? {}, context);

  const oldResult = redactValue(event.oldValue, event.fieldName);
  const newResult = redactValue(event.newValue, event.fieldName);

  const redacted = redactMetadata(metadata);
  const finalMetadata = { ...redacted.metadata } as Record<string, unknown>;

  const truncatedFields: string[] = [];
  if (oldResult.truncated) truncatedFields.push("oldValue");
  if (newResult.truncated) truncatedFields.push("newValue");
  if (redacted.truncated) truncatedFields.push("metadata");
  if (truncatedFields.length > 0) {
    finalMetadata.truncated = true;
    finalMetadata.truncatedFields = truncatedFields;
  }

  return prisma.auditLog.create({
    data: {
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      fieldName: event.fieldName ?? null,
      oldValue: oldResult.value,
      newValue: newResult.value,
      organizationId: event.organizationId ?? null,
      actorUserId: event.actor?.id ?? null,
      actorEmail: event.actor?.email ?? null,
      actorRole: event.actor?.role ?? null,
      success: event.success ?? true,
      errorMessage: event.errorMessage ?? null,
      requestId: context.requestId ?? null,
      metadata: Object.keys(finalMetadata).length > 0 ? finalMetadata : null
    }
  });
}

export async function logFieldChanges(params: {
  action: AuditAction;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  actor?: AuditActor;
  requestContext?: AuditRequestContext;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
  metadata?: Record<string, unknown>;
}) {
  const { before, after, fields } = params;

  for (const field of fields) {
    const beforeValue = before[field];
    const afterValue = after[field];

    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue;
    }

    await logAuditEvent({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      fieldName: field,
      oldValue: beforeValue,
      newValue: afterValue,
      organizationId: params.organizationId ?? null,
      actor: params.actor,
      requestContext: params.requestContext,
      metadata: params.metadata
    });
  }
}
