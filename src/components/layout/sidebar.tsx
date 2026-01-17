"use client";

import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GitCompare,
  KeyRound,
  LayoutGrid,
  TrendingUp,
  BookOpen,
  Link as LinkIcon,
  Map,
  ShieldCheck,
  Users
} from "lucide-react";
import NavLink from "@/components/layout/nav-link";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/organizations", label: "Organizacoes", icon: Building2 },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/cis", label: "Controles CIS", icon: ShieldCheck },
  { href: "/compare", label: "Comparativo", icon: GitCompare },
  { href: "/evolucao", label: "Evolucao", icon: TrendingUp },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/evidences", label: "Evidencias", icon: FileText },
  { href: "/mappings", label: "Mapeamentos", icon: LinkIcon },
  { href: "/docs", label: "Documentacao", icon: BookOpen },
  { href: "/users", label: "Usuarios", icon: Users, adminOnly: true },
  { href: "/auditoria", label: "Auditoria", icon: ClipboardList, adminOnly: true },
  { href: "/auth", label: "Autenticacao", icon: KeyRound, adminOnly: true }
];

type SidebarProps = {
  role?: string | null;
};

export default function Sidebar({ role }: SidebarProps) {
  const isAdmin = role === "ADMIN";

  return (
    <nav className="flex flex-col gap-2">
      {items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
    </nav>
  );
}
