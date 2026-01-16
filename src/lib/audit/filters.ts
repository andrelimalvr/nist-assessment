import type { AuditAction, Prisma, Role } from "@prisma/client";

export type AuditFilterParams = {
  action?: string | null;
  role?: string | null;
  userId?: string | null;
  entityType?: string | null;
  fieldName?: string | null;
  organizationId?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: string | null;
  dir?: string | null;
};

export function buildAuditWhere(params: AuditFilterParams): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (params.action) {
    where.action = params.action as AuditAction;
  }

  if (params.role) {
    where.actorRole = params.role as Role;
  }

  if (params.userId) {
    where.actorUserId = params.userId;
  }

  if (params.entityType) {
    where.entityType = params.entityType;
  }

  if (params.fieldName) {
    where.fieldName = { contains: params.fieldName, mode: "insensitive" };
  }

  if (params.organizationId) {
    where.organizationId = params.organizationId;
  }

  if (params.from || params.to) {
    where.timestamp = {};
    if (params.from) {
      where.timestamp.gte = new Date(params.from);
    }
    if (params.to) {
      const end = new Date(params.to);
      end.setHours(23, 59, 59, 999);
      where.timestamp.lte = end;
    }
  }

  return where;
}

export function buildAuditOrder(sort?: string | null, dir?: string | null) {
  const direction = dir === "asc" ? "asc" : "desc";

  switch (sort) {
    case "action":
      return [{ action: direction }, { timestamp: "desc" }, { id: "desc" }];
    case "user":
      return [{ actorEmail: direction }, { timestamp: "desc" }, { id: "desc" }];
    case "role":
      return [{ actorRole: direction }, { timestamp: "desc" }, { id: "desc" }];
    case "entity":
      return [{ entityType: direction }, { timestamp: "desc" }, { id: "desc" }];
    case "field":
      return [{ fieldName: direction }, { timestamp: "desc" }, { id: "desc" }];
    case "organization":
      return [{ organizationId: direction }, { timestamp: "desc" }, { id: "desc" }];
    case "result":
      return [{ success: direction }, { timestamp: "desc" }, { id: "desc" }];
    default:
      return [{ timestamp: "desc" }, { id: "desc" }];
  }
}
