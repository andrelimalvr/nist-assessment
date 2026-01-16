"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/sorters";

type SortHeaderProps = {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
};

export default function SortHeader({
  label,
  active,
  direction,
  onClick,
  className
}: SortHeaderProps) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide",
        active ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
