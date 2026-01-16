"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export default function NavLink({ href, label, icon: Icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-white/80 text-foreground shadow-sm dark:bg-slate-900/80"
          : "text-muted-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-slate-900/60"
      )}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{label}</span>
    </Link>
  );
}
