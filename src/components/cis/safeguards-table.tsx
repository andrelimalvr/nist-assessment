"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import { formatNumber } from "@/lib/format";
import { ptBR } from "@/lib/i18n/ptBR";
import {
  applySortDirection,
  compareCisStatus,
  compareControlId,
  compareImplementationGroup,
  compareNumbers,
  compareSafeguardId,
  compareSsdfId,
  compareStringsLocale,
  SortDirection
} from "@/lib/sorters";

type SafeguardRow = {
  safeguardId: string;
  safeguardLabel: string;
  controlId: string;
  controlLabel: string;
  ig: string;
  statusKey: string;
  statusLabel: string;
  maturity: number;
  coverage: number;
  origin: string;
  sourceTaskSortKey: string;
  sourceTasks: string;
};

type SortKey =
  | "safeguardId"
  | "controlId"
  | "ig"
  | "status"
  | "maturity"
  | "coverage"
  | "origin"
  | "sourceTask";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type SafeguardsTableProps = {
  rows: SafeguardRow[];
};

export default function SafeguardsTable({ rows }: SafeguardsTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "safeguardId", direction: "asc" });

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let result = 0;
      switch (sort.key) {
        case "safeguardId":
          result = compareSafeguardId(a.safeguardId, b.safeguardId);
          break;
        case "controlId":
          result = compareControlId(a.controlId, b.controlId);
          break;
        case "ig":
          result = compareImplementationGroup(a.ig, b.ig);
          break;
        case "status":
          result = compareCisStatus(a.statusKey, b.statusKey);
          break;
        case "maturity":
          result = compareNumbers(a.maturity, b.maturity);
          break;
        case "coverage":
          result = compareNumbers(a.coverage, b.coverage);
          break;
        case "origin":
          result = compareStringsLocale(a.origin, b.origin, "pt-BR");
          break;
        case "sourceTask":
          result = compareSsdfId(a.sourceTaskSortKey, b.sourceTaskSortKey);
          break;
        default:
          result = 0;
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
              label={ptBR.columns.safeguard}
              active={sort.key === "safeguardId"}
              direction={sort.direction}
              onClick={() => toggleSort("safeguardId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.control}
              active={sort.key === "controlId"}
              direction={sort.direction}
              onClick={() => toggleSort("controlId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.ig}
              active={sort.key === "ig"}
              direction={sort.direction}
              onClick={() => toggleSort("ig")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.status}
              active={sort.key === "status"}
              direction={sort.direction}
              onClick={() => toggleSort("status")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.maturity}
              active={sort.key === "maturity"}
              direction={sort.direction}
              onClick={() => toggleSort("maturity")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.coverage}
              active={sort.key === "coverage"}
              direction={sort.direction}
              onClick={() => toggleSort("coverage")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.source}
              active={sort.key === "origin"}
              direction={sort.direction}
              onClick={() => toggleSort("origin")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.cis.relatedSsdf}
              active={sort.key === "sourceTask"}
              direction={sort.direction}
              onClick={() => toggleSort("sourceTask")}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((row) => (
          <TableRow key={row.safeguardId}>
            <TableCell className="font-medium">{row.safeguardLabel}</TableCell>
            <TableCell>{row.controlLabel}</TableCell>
            <TableCell>{row.ig}</TableCell>
            <TableCell>{row.statusLabel}</TableCell>
            <TableCell>{row.maturity}</TableCell>
            <TableCell>{formatNumber(row.coverage, 1)}%</TableCell>
            <TableCell>{row.origin}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {row.sourceTasks || ptBR.common.notAvailable}
            </TableCell>
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-sm text-muted-foreground">
              {ptBR.cis.emptySafeguards}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
