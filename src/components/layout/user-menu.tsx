"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type UserMenuProps = {
  name?: string | null;
  role?: string | null;
  email?: string | null;
};

export default function UserMenu({ name, role, email }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <span className="text-left">
            <span className="block text-sm font-semibold">{name ?? "Usuario"}</span>
            <span className="block text-xs text-muted-foreground">{role ?? ""}</span>
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-xs text-muted-foreground">{email}</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/conta">Conta</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
