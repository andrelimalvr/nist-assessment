"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SortHeader from "@/components/table/sort-header";
import type { SortDirection } from "@/lib/sorters";

type SortableTableHeaderProps = {
  label: string;
  sortKey: string;
  defaultSortKey: string;
  defaultDirection?: SortDirection;
  initialDirection?: SortDirection;
  paramKey?: string;
  dirParamKey?: string;
  className?: string;
};

export default function SortableTableHeader({
  label,
  sortKey,
  defaultSortKey,
  defaultDirection = "asc",
  initialDirection = "asc",
  paramKey = "sort",
  dirParamKey = "dir",
  className
}: SortableTableHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get(paramKey) ?? defaultSortKey;
  const dirParam = searchParams.get(dirParamKey);
  const hasDir = dirParam === "asc" || dirParam === "desc";
  const resolvedDir: SortDirection = hasDir
    ? (dirParam as SortDirection)
    : currentSort === defaultSortKey
      ? defaultDirection
      : initialDirection;
  const isActive = currentSort === sortKey;
  const direction: SortDirection = isActive ? resolvedDir : initialDirection;

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir = isActive ? (resolvedDir === "asc" ? "desc" : "asc") : initialDirection;
    params.set(paramKey, sortKey);
    params.set(dirParamKey, nextDir);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <SortHeader
      label={label}
      active={isActive}
      direction={direction}
      onClick={handleClick}
      className={className}
    />
  );
}
