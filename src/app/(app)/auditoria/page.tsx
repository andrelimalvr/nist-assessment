import { getServerSession } from "next-auth";
import { AuditAction, Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAuditOrder, buildAuditWhere } from "@/lib/audit/filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AuditTable from "@/components/audit/audit-table";

const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams
}: {
  searchParams?: {
    action?: string;
    role?: string;
    userId?: string;
    entityType?: string;
    fieldName?: string;
    organizationId?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: string;
    cursor?: string;
    direction?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === Role.ADMIN;

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Auditoria
        </h1>
        <p className="text-muted-foreground">Acesso restrito ao admin.</p>
      </div>
    );
  }

  const where = buildAuditWhere({
    action: searchParams?.action ?? null,
    role: searchParams?.role ?? null,
    userId: searchParams?.userId ?? null,
    entityType: searchParams?.entityType ?? null,
    fieldName: searchParams?.fieldName ?? null,
    organizationId: searchParams?.organizationId ?? null,
    from: searchParams?.from ?? null,
    to: searchParams?.to ?? null,
    sort: searchParams?.sort ?? null,
    dir: searchParams?.dir ?? null
  });

  const orderBy = buildAuditOrder(searchParams?.sort ?? null, searchParams?.dir ?? null);
  const cursor = searchParams?.cursor ?? null;
  const direction = searchParams?.direction === "prev" ? "prev" : "next";

  const [users, organizations, logs, total] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null }, orderBy: { email: "asc" } }),
    prisma.organization.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({
      where,
      orderBy,
      take: direction === "prev" ? -PAGE_SIZE : PAGE_SIZE,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: { organization: true }
    }),
    prisma.auditLog.count({ where })
  ]);

  const normalizedLogs = direction === "prev" ? logs.reverse() : logs;
  const nextCursor = normalizedLogs.length === PAGE_SIZE ? normalizedLogs[normalizedLogs.length - 1]?.id : null;
  const prevCursor = normalizedLogs.length > 0 ? normalizedLogs[0]?.id : null;

  const rows = normalizedLogs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp.toISOString().replace("T", " ").slice(0, 19),
    action: log.action,
    actorEmail: log.actorEmail,
    actorRole: log.actorRole,
    entityType: log.entityType,
    fieldName: log.fieldName,
    organizationName: log.organization?.name ?? null,
    success: log.success,
    oldValue: log.oldValue,
    newValue: log.newValue,
    metadata: log.metadata as Record<string, unknown> | null
  }));

  const buildQuery = (params: Record<string, string | null | undefined>) => {
    const urlParams = new URLSearchParams();
    Object.entries({
      action: searchParams?.action,
      role: searchParams?.role,
      userId: searchParams?.userId,
      entityType: searchParams?.entityType,
      fieldName: searchParams?.fieldName,
      organizationId: searchParams?.organizationId,
      from: searchParams?.from,
      to: searchParams?.to,
      sort: searchParams?.sort,
      dir: searchParams?.dir,
      ...params
    }).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    return urlParams.toString();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Auditoria
          </h1>
          <p className="text-muted-foreground">Logs de atividades e alteracoes criticas.</p>
        </div>
        <Button asChild variant="secondary">
          <a href={`/api/admin/audit/export?${buildQuery({})}`} target="_blank" rel="noreferrer">
            Exportar CSV
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-6" method="GET">
            <select
              name="action"
              defaultValue={searchParams?.action ?? ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Acao</option>
              {Object.values(AuditAction).map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <select
              name="role"
              defaultValue={searchParams?.role ?? ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Funcao</option>
              <option value={Role.ADMIN}>ADMIN</option>
              <option value={Role.ASSESSOR}>ASSESSOR</option>
              <option value={Role.VIEWER}>VIEWER</option>
            </select>
            <select
              name="userId"
              defaultValue={searchParams?.userId ?? ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Usuario</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
            <Input
              name="entityType"
              defaultValue={searchParams?.entityType ?? ""}
              placeholder="Entidade"
            />
            <Input
              name="fieldName"
              defaultValue={searchParams?.fieldName ?? ""}
              placeholder="Campo"
            />
            <select
              name="organizationId"
              defaultValue={searchParams?.organizationId ?? ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Organizacao</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <Input name="from" type="date" defaultValue={searchParams?.from ?? ""} />
            <Input name="to" type="date" defaultValue={searchParams?.to ?? ""} />
            <div className="md:col-span-6">
              <Button type="submit">Aplicar filtros</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Total: {total}</span>
        <span>Pagina: {PAGE_SIZE} registros</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTable rows={rows} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="outline"
          disabled={!cursor}
        >
          <a href={`/auditoria?${buildQuery({ cursor: prevCursor ?? "", direction: "prev" })}`}>Anterior</a>
        </Button>
        <Button
          asChild
          variant="outline"
          disabled={!nextCursor}
        >
          <a href={`/auditoria?${buildQuery({ cursor: nextCursor ?? "", direction: "next" })}`}>Proxima</a>
        </Button>
      </div>
    </div>
  );
}
