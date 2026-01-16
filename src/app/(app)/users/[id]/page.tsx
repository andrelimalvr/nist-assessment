import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateUserAccess } from "@/app/(app)/users/actions";

export default async function UserEditPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === Role.ADMIN;

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Editar usuario
        </h1>
        <p className="text-muted-foreground">Acesso restrito ao admin.</p>
      </div>
    );
  }

  const [user, organizations] = await Promise.all([
    prisma.user.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { userOrganizations: true }
    }),
    prisma.organization.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } })
  ]);

  if (!user) {
    notFound();
  }

  const currentOrgIds = new Set(user.userOrganizations.map((item) => item.organizationId));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Editar usuario
          </h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/users">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acesso e role</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateUserAccess} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="userId" value={user.id} />
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select
                name="role"
                defaultValue={user.role}
                className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                required
              >
                <option value={Role.ADMIN}>Admin</option>
                <option value={Role.ASSESSOR}>Assessor</option>
                <option value={Role.VIEWER}>Viewer</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Organizacoes</label>
              {organizations.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {organizations.map((org) => (
                    <label key={org.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="organizationIds"
                        value={org.id}
                        defaultChecked={currentOrgIds.has(org.id)}
                      />
                      {org.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma organizacao cadastrada.</p>
              )}
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Salvar alteracoes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
