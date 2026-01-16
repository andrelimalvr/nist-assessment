"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import { ptBR } from "@/lib/i18n/ptBR";
import { applySortDirection, compareControlId, compareNumbers, SortDirection } from "@/lib/sorters";
import { formatNumber } from "@/lib/format";

type HeatmapRow = {
  controlId: string;
  controlLabel: string;
  scores: Record<string, number>;
};

type SortKey = "controlId" | string;

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type HeatmapTableProps = {
  groups: string[];
  rows: HeatmapRow[];
};

export default function HeatmapTable({ groups, rows }: HeatmapTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "controlId", direction: "asc" });

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let result = 0;
      if (sort.key === "controlId") {
        result = compareControlId(a.controlId, b.controlId);
      } else {
        const aScore = a.scores[sort.key] ?? 0;
        const bScore = b.scores[sort.key] ?? 0;
        result = compareNumbers(aScore, bScore);
      }
      return applySortDirection(result, sort.direction);
    });
    return sorted;
  }, [rows, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortHeader
              label={ptBR.columns.control}
              active={sort.key === "controlId"}
              direction={sort.direction}
              onClick={() => toggleSort("controlId")}
            />
          </TableHead>
          {groups.map((groupId) => (
            <TableHead key={groupId}>
              <SortHeader
                label={groupId}
                active={sort.key === groupId}
                direction={sort.direction}
                onClick={() => toggleSort(groupId)}
              />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((row) => (
          <TableRow key={row.controlId}>
            <TableCell className="font-medium">{row.controlLabel}</TableCell>
            {groups.map((groupId) => {
              const score = row.scores[groupId] ?? 0;
              return <TableCell key={groupId}>{formatNumber(score, 1)}%</TableCell>;
            })}
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={groups.length + 1} className="text-sm text-muted-foreground">
              {ptBR.common.noData}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
