import Link from "next/link";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import CreateUserForm from "@/components/users/create-user-form";
import DeleteUserButton from "@/components/users/delete-user-button";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === Role.ADMIN;

  const [organizations, users] = await Promise.all([
    prisma.organization.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { deletedAt: null },
      include: { userOrganizations: { include: { organization: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Usuarios
        </h1>
        <p className="text-muted-foreground">Acesso restrito ao admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Usuarios
        </h1>
        <p className="text-muted-foreground">Crie usuarios e defina seus perfis de acesso.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUserForm organizations={organizations} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organizacoes</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.userOrganizations.length > 0
                      ? user.userOrganizations.map((item) => item.organization.name).join(", ")
                      : user.role === Role.ADMIN
                        ? "Todas"
                        : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/users/${user.id}`}>Editar</Link>
                      </Button>
                      <DeleteUserButton
                        userId={user.id}
                        userName={user.name}
                        userEmail={user.email}
                        currentUserId={session?.user?.id}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Nenhum usuario cadastrado.
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
