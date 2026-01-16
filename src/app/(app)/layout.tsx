import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/layout/sidebar";
import UserMenu from "@/components/layout/user-menu";
import ThemeToggle from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const powerBiUrl = process.env.NEXT_PUBLIC_POWER_BI_URL;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col border-b border-border bg-white/70 px-6 py-8 dark:bg-slate-950/70 lg:border-b-0 lg:border-r">
        <Link href="/dashboard" className="mb-8">
          <div className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            SSDF Compass
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">NIST SP 800-218</p>
        </Link>
        <Sidebar />
        <div className="mt-auto rounded-xl border border-border bg-white/80 p-4 text-xs text-muted-foreground dark:bg-slate-950/80">
          <p className="font-semibold text-foreground">Maturidade em foco</p>
          <p>Atualize respostas e acompanhe o score por grupo.</p>
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border bg-white/70 px-6 py-4 dark:bg-slate-950/70">
          <div>
            <p className="text-sm text-muted-foreground">Bem-vindo</p>
            <p className="text-lg font-semibold">{session?.user?.name ?? ""}</p>
          </div>
          <div className="flex items-center gap-3">
            {powerBiUrl ? (
              <Button asChild variant="secondary">
                <a href={powerBiUrl} target="_blank" rel="noreferrer">
                  Power BI
                </a>
              </Button>
            ) : null}
            <ThemeToggle />
            <UserMenu
              name={session?.user?.name}
              role={session?.user?.role}
              email={session?.user?.email}
            />
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
