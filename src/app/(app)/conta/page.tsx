import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ChangePasswordForm from "@/components/account/change-password-form";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const name = session.user.name ?? "";
  const email = session.user.email ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Minha conta
        </h1>
        <p className="text-muted-foreground">Gerencie seus dados e senha.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do usuario</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={email} readOnly />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input value={name} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={email} />
        </CardContent>
      </Card>
    </div>
  );
}
