import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FirstAccessForm from "@/components/account/first-access-form";

export default async function FirstAccessPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (session.user.mustChangePassword === false) {
    redirect("/dashboard");
  }

  const email = session.user.email ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            Primeiro acesso
          </CardTitle>
          <CardDescription>Altere sua senha para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <FirstAccessForm email={email} />
        </CardContent>
      </Card>
    </div>
  );
}
