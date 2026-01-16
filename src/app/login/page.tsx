import LoginForm from "@/components/auth/login-form";
import SsoButtons from "@/components/auth/sso-buttons";
import ThemeToggle from "@/components/theme/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            SSDF Assessment
          </CardTitle>
          <CardDescription>
            Acesse para conduzir assessments e acompanhar maturidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm />
          <SsoButtons />
        </CardContent>
      </Card>
    </div>
  );
}
