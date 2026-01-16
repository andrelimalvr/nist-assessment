import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { getAccessibleOrganizationIds } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createOrganization } from "@/app/(app)/organizations/actions";
import DeleteOrganizationButton from "@/components/organizations/delete-organization-button";

export default async function OrganizationsPage() {
  const session = await getServerSession(authOptions);
  const allowEdit = canEdit(session?.user?.role);

  const accessibleOrgIds = await getAccessibleOrganizationIds(session);
  const orgFilter =
    session?.user?.role === Role.ADMIN || accessibleOrgIds === null
      ? { deletedAt: null }
      : { id: { in: accessibleOrgIds }, deletedAt: null };

  const organizations = await prisma.organization.findMany({
    where: orgFilter,
    include: {
      _count: { select: { assessments: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Organizacoes
        </h1>
        <p className="text-muted-foreground">
          Gerencie empresas e acompanhe o numero de assessments por organizacao.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova organizacao</CardTitle>
        </CardHeader>
        <CardContent>
          {allowEdit && session?.user?.role === Role.ADMIN ? (
            <form action={createOrganization} className="flex flex-col gap-3 md:flex-row">
              <Input name="name" placeholder="Nome da empresa" required />
              <Button type="submit">Criar</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Acesso somente leitura.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empresas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Assessments</TableHead>
                <TableHead>Criado em</TableHead>
                {session?.user?.role === Role.ADMIN ? <TableHead>Acoes</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-semibold">{org.name}</TableCell>
                  <TableCell>{org._count.assessments}</TableCell>
                  <TableCell>{org.createdAt.toISOString().slice(0, 10)}</TableCell>
                  {session?.user?.role === Role.ADMIN ? (
                    <TableCell>
                      <DeleteOrganizationButton
                        organizationId={org.id}
                        organizationName={org.name}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={session?.user?.role === Role.ADMIN ? 4 : 3}
                    className="text-sm text-muted-foreground"
                  >
                    Nenhuma organizacao cadastrada.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
