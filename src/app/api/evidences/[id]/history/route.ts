import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const evidence = await prisma.evidence.findUnique({
    where: { id: params.id },
    include: { ssdfResult: { include: { assessment: { select: { organizationId: true, deletedAt: true } } } } }
  });

  if (!evidence || evidence.ssdfResult.assessment.deletedAt) {
    return NextResponse.json({ error: "Evidencia nao encontrada" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(
    session,
    evidence.ssdfResult.assessment.organizationId
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user")?.trim();
  const field = searchParams.get("field")?.trim();
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  const andFilters: any[] = [];
  if (user) {
    andFilters.push({
      OR: [
        { changedByUserId: user },
        { changedByUser: { email: { contains: user, mode: "insensitive" } } },
        { changedByUser: { name: { contains: user, mode: "insensitive" } } }
      ]
    });
  }

  if (field) {
    andFilters.push({ fieldName: field });
  }

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    andFilters.push({ changedAt: range });
  }

  const history = await prisma.evidenceHistory.findMany({
    where: {
      evidenceId: evidence.id,
      ...(andFilters.length > 0 ? { AND: andFilters } : {})
    },
    include: {
      changedByUser: { select: { id: true, name: true, email: true } }
    },
    orderBy: { changedAt: "desc" }
  });

  return NextResponse.json({
    items: history.map((item) => ({
      id: item.id,
      fieldName: item.fieldName,
      oldValue: item.oldValue,
      newValue: item.newValue,
      reason: item.reason,
      changedAt: item.changedAt.toISOString(),
      changedByUser: item.changedByUser,
      metadata: item.metadata
    }))
  });
}
