import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createOrganization } from "@/app/(app)/organizations/actions";

export default async function OrganizationsPage() {
  const session = await getServerSession(authOptions);
  const organizations = await prisma.organization.findMany({
    include: {
      _count: { select: { assessments: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const allowEdit = canEdit(session?.user?.role);

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
          {allowEdit ? (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-semibold">{org.name}</TableCell>
                  <TableCell>{org._count.assessments}</TableCell>
                  <TableCell>{org.createdAt.toISOString().slice(0, 10)}</TableCell>
                </TableRow>
              ))}
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
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
