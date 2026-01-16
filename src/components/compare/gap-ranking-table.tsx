"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import { ptBR } from "@/lib/i18n/ptBR";
import {
  applySortDirection,
  compareNumbers,
  compareSafeguardId,
  compareStrings,
  SortDirection
} from "@/lib/sorters";
import { formatNumber } from "@/lib/format";

type GapRankingRow = {
  safeguardId: string;
  safeguardLabel: string;
  ig: string;
  maturity: number;
  coverage: number;
  sourceLabel: string;
  gapScore: number;
};

type SortKey =
  | "safeguardId"
  | "ig"
  | "maturity"
  | "coverage"
  | "sourceLabel"
  | "gapScore";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type GapRankingTableProps = {
  rows: GapRankingRow[];
};

export default function GapRankingTable({ rows }: GapRankingTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "gapScore", direction: "desc" });

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let result = 0;
      switch (sort.key) {
        case "safeguardId":
          result = compareSafeguardId(a.safeguardId, b.safeguardId);
          break;
        case "ig":
          result = compareStrings(a.ig, b.ig);
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
        case "gapScore":
          result = compareNumbers(a.gapScore, b.gapScore);
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
              label={ptBR.columns.ig}
              active={sort.key === "ig"}
              direction={sort.direction}
              onClick={() => toggleSort("ig")}
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
              label={ptBR.compare.gapScore}
              active={sort.key === "gapScore"}
              direction={sort.direction}
              onClick={() => toggleSort("gapScore")}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((row) => (
          <TableRow key={row.safeguardId}>
            <TableCell className="font-medium">{row.safeguardLabel}</TableCell>
            <TableCell>{row.ig}</TableCell>
            <TableCell>{formatNumber(row.maturity, 1)}</TableCell>
            <TableCell>{formatNumber(row.coverage, 1)}%</TableCell>
            <TableCell>{row.sourceLabel}</TableCell>
            <TableCell>{formatNumber(row.gapScore, 1)}</TableCell>
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-sm text-muted-foreground">
              {ptBR.compare.noGaps}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
