import { prisma } from "@/lib/prisma";
import { redactMetadata, redactValue } from "@/lib/audit/redact";
import { getRequestContext } from "@/lib/audit/request";

export type HistoryRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  route?: string;
};

type HistoryChangeParams = {
  changedByUserId?: string | null;
  reason?: string | null;
  requestContext?: HistoryRequestContext;
  metadata?: Record<string, unknown>;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
};

function mergeMetadata(
  metadata: Record<string, unknown>,
  requestContext?: HistoryRequestContext
) {
  const base = { ...metadata };
  if (requestContext?.requestId) base.requestId = requestContext.requestId;
  if (requestContext?.ip) base.ip = requestContext.ip;
  if (requestContext?.userAgent) base.userAgent = requestContext.userAgent;
  if (requestContext?.route) base.route = requestContext.route;
  return base;
}

function buildMetadata(params: {
  metadata?: Record<string, unknown>;
  requestContext?: HistoryRequestContext;
  oldTruncated: boolean;
  newTruncated: boolean;
}) {
  const merged = mergeMetadata(params.metadata ?? {}, params.requestContext);
  const redacted = redactMetadata(merged);
  const finalMetadata = { ...redacted.metadata } as Record<string, unknown>;

  const truncatedFields: string[] = [];
  if (params.oldTruncated) truncatedFields.push("oldValue");
  if (params.newTruncated) truncatedFields.push("newValue");
  if (redacted.truncated) truncatedFields.push("metadata");

  if (truncatedFields.length > 0) {
    finalMetadata.truncated = true;
    finalMetadata.truncatedFields = truncatedFields;
  }

  return Object.keys(finalMetadata).length > 0 ? finalMetadata : null;
}

function valuesDiffer(a: unknown, b: unknown) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export async function logAssessmentTaskHistory(
  params: HistoryChangeParams & { assessmentTaskResultId: string }
) {
  const context = params.requestContext ?? getRequestContext();
  const { before, after, fields } = params;

  for (const field of fields) {
    const beforeValue = before[field];
    const afterValue = after[field];

    if (!valuesDiffer(beforeValue, afterValue)) {
      continue;
    }

    const oldResult = redactValue(beforeValue, field);
    const newResult = redactValue(afterValue, field);
    const metadata = buildMetadata({
      metadata: params.metadata,
      requestContext: context,
      oldTruncated: oldResult.truncated,
      newTruncated: newResult.truncated
    });

    await prisma.assessmentTaskHistory.create({
      data: {
        assessmentTaskResultId: params.assessmentTaskResultId,
        changedByUserId: params.changedByUserId ?? null,
        fieldName: field,
        oldValue: oldResult.value,
        newValue: newResult.value,
        reason: params.reason ?? null,
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata
      }
    });
  }
}

export async function logEvidenceHistory(
  params: HistoryChangeParams & { evidenceId: string }
) {
  const context = params.requestContext ?? getRequestContext();
  const { before, after, fields } = params;

  for (const field of fields) {
    const beforeValue = before[field];
    const afterValue = after[field];

    if (!valuesDiffer(beforeValue, afterValue)) {
      continue;
    }

    const oldResult = redactValue(beforeValue, field);
    const newResult = redactValue(afterValue, field);
    const metadata = buildMetadata({
      metadata: params.metadata,
      requestContext: context,
      oldTruncated: oldResult.truncated,
      newTruncated: newResult.truncated
    });

    await prisma.evidenceHistory.create({
      data: {
        evidenceId: params.evidenceId,
        changedByUserId: params.changedByUserId ?? null,
        fieldName: field,
        oldValue: oldResult.value,
        newValue: newResult.value,
        reason: params.reason ?? null,
        metadata
      }
    });
  }
}
