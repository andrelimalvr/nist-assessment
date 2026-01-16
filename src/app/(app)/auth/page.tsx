import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getAuthConfig } from "@/lib/auth-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthConfigForm from "@/components/auth/auth-config-form";

export default async function AuthConfigPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === Role.ADMIN;

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Autenticacao
        </h1>
        <p className="text-muted-foreground">Acesso restrito ao admin.</p>
      </div>
    );
  }

  const config = await getAuthConfig();
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const redirectUri = `${nextAuthUrl}/api/auth/callback/oidc`;
  const secretConfigured = Boolean(process.env.OIDC_CLIENT_SECRET);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Autenticacao
        </h1>
        <p className="text-muted-foreground">
          Configure SSO OIDC e defina politicas de login para a plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SSO (OIDC)</CardTitle>
          <CardDescription>
            O client secret deve ser configurado via env (OIDC_CLIENT_SECRET) e nao e exibido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
            <p className="font-semibold">Redirect URI</p>
            <p className="mt-1 break-all">{redirectUri}</p>
            <p className="mt-2 text-muted-foreground">
              Client secret configurado: {secretConfigured ? "sim" : "nao"}
            </p>
          </div>
          <AuthConfigForm initialConfig={config} />
        </CardContent>
      </Card>
    </div>
  );
}
