"use client";

import { Building2, ClipboardCheck, FileText, LayoutGrid, Map, Users } from "lucide-react";
import NavLink from "@/components/layout/nav-link";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/organizations", label: "Organizacoes", icon: Building2 },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/evidences", label: "Evidencias", icon: FileText },
  { href: "/users", label: "Usuarios", icon: Users }
];

export default function Sidebar() {
  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
