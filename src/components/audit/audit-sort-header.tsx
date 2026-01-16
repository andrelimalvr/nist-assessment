"use client";

import { useRouter, useSearchParams } from "next/navigation";
import SortHeader from "@/components/table/sort-header";
import type { SortDirection } from "@/lib/sorters";

type AuditSortHeaderProps = {
  label: string;
  sortKey: string;
};

export default function AuditSortHeader({ label, sortKey }: AuditSortHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "timestamp";
  const currentDir = (searchParams.get("dir") as SortDirection) ?? "desc";
  const isActive = currentSort === sortKey;

  const direction: SortDirection = isActive ? currentDir : "desc";

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir = isActive ? (currentDir === "asc" ? "desc" : "asc") : sortKey === "timestamp" ? "desc" : "asc";
    params.set("sort", sortKey);
    params.set("dir", nextDir);
    params.delete("cursor");
    params.delete("direction");
    router.push(`/auditoria?${params.toString()}`);
  };

  return (
    <SortHeader
      label={label}
      active={isActive}
      direction={direction}
      onClick={handleClick}
    />
  );
}
