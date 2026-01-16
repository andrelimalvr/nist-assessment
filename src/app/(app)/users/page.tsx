import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createUser } from "@/app/(app)/users/actions";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === Role.ADMIN;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" }
  });

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
          <form action={createUser} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input name="name" placeholder="Nome completo" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input name="email" type="email" placeholder="usuario@empresa.com" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input name="password" type="password" placeholder="Minimo 6 caracteres" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select
                name="role"
                className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                required
              >
                <option value={Role.ADMIN}>Admin</option>
                <option value={Role.ASSESSOR}>Assessor</option>
                <option value={Role.VIEWER}>Viewer</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Criar usuario</Button>
            </div>
          </form>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                </TableRow>
              ))}
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
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
