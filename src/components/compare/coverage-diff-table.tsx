"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import { ptBR } from "@/lib/i18n/ptBR";
import {
  applySortDirection,
  compareControlId,
  compareNumbers,
  compareSafeguardId,
  compareStrings,
  SortDirection
} from "@/lib/sorters";
import { formatNumber } from "@/lib/format";

type CoverageDiffRow = {
  safeguardId: string;
  safeguardLabel: string;
  controlId: string;
  controlLabel: string;
  ig: string;
  statusLabel: string;
  maturity: number;
  coverage: number;
  sourceLabel: string;
  gapReason: string;
};

type SortKey =
  | "safeguardId"
  | "controlId"
  | "ig"
  | "statusLabel"
  | "maturity"
  | "coverage"
  | "sourceLabel"
  | "gapReason";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type CoverageDiffTableProps = {
  rows: CoverageDiffRow[];
};

export default function CoverageDiffTable({ rows }: CoverageDiffTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "controlId", direction: "asc" });

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
          result = compareStrings(a.ig, b.ig);
          break;
        case "statusLabel":
          result = compareStrings(a.statusLabel, b.statusLabel);
          break;
        case "maturity":
          result = compareNumbers(a.maturity, b.maturity);
          break;
        case "coverage":
          result = compareNumbers(a.coverage, b.coverage);
          break;
        case "sourceLabel":
          result = compareStrings(a.sourceLabel, b.sourceLabel);
          break;
        case "gapReason":
          result = compareStrings(a.gapReason, b.gapReason);
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
              active={sort.key === "statusLabel"}
              direction={sort.direction}
              onClick={() => toggleSort("statusLabel")}
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
              active={sort.key === "sourceLabel"}
              direction={sort.direction}
              onClick={() => toggleSort("sourceLabel")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.compare.gapReason}
              active={sort.key === "gapReason"}
              direction={sort.direction}
              onClick={() => toggleSort("gapReason")}
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
            <TableCell>{formatNumber(row.maturity, 1)}</TableCell>
            <TableCell>{formatNumber(row.coverage, 1)}%</TableCell>
            <TableCell>{row.sourceLabel}</TableCell>
            <TableCell>{row.gapReason}</TableCell>
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-sm text-muted-foreground">
              {ptBR.compare.noComparisonData}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
