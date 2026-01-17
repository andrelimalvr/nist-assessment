"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import { ptBR } from "@/lib/i18n/ptBR";
import { applySortDirection, compareControlId, compareNumbers, SortDirection } from "@/lib/sorters";
import { formatNumber } from "@/lib/format";
import DrilldownDrawer from "@/components/assessment/drilldown-drawer";

type ControlSummaryRow = {
  controlId: string;
  controlLabel: string;
  safeguardsTotal: number;
  derivedCount: number;
  manualOverrideCount: number;
  notMappedCount: number;
  avgMaturity: number;
  avgCoverage: number;
};

type SortKey =
  | "controlId"
  | "safeguardsTotal"
  | "derivedCount"
  | "manualOverrideCount"
  | "notMappedCount"
  | "avgMaturity"
  | "avgCoverage";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type ControlSummaryTableProps = {
  rows: ControlSummaryRow[];
  assessmentId: string;
};

export default function ControlSummaryTable({ rows, assessmentId }: ControlSummaryTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "controlId", direction: "asc" });

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let result = 0;
      switch (sort.key) {
        case "controlId":
          result = compareControlId(a.controlId, b.controlId);
          break;
        case "safeguardsTotal":
          result = compareNumbers(a.safeguardsTotal, b.safeguardsTotal);
          break;
        case "derivedCount":
          result = compareNumbers(a.derivedCount, b.derivedCount);
          break;
        case "manualOverrideCount":
          result = compareNumbers(a.manualOverrideCount, b.manualOverrideCount);
          break;
        case "notMappedCount":
          result = compareNumbers(a.notMappedCount, b.notMappedCount);
          break;
        case "avgMaturity":
          result = compareNumbers(a.avgMaturity, b.avgMaturity);
          break;
        case "avgCoverage":
          result = compareNumbers(a.avgCoverage, b.avgCoverage);
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
              label={ptBR.columns.control}
              active={sort.key === "controlId"}
              direction={sort.direction}
              onClick={() => toggleSort("controlId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.totalSafeguards}
              active={sort.key === "safeguardsTotal"}
              direction={sort.direction}
              onClick={() => toggleSort("safeguardsTotal")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.derived}
              active={sort.key === "derivedCount"}
              direction={sort.direction}
              onClick={() => toggleSort("derivedCount")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.overrides}
              active={sort.key === "manualOverrideCount"}
              direction={sort.direction}
              onClick={() => toggleSort("manualOverrideCount")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.gaps}
              active={sort.key === "notMappedCount"}
              direction={sort.direction}
              onClick={() => toggleSort("notMappedCount")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.avgMaturity}
              active={sort.key === "avgMaturity"}
              direction={sort.direction}
              onClick={() => toggleSort("avgMaturity")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label={ptBR.columns.avgCoverage}
              active={sort.key === "avgCoverage"}
              direction={sort.direction}
              onClick={() => toggleSort("avgCoverage")}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((control) => (
          <TableRow key={control.controlId}>
            <TableCell className="font-medium">
              <DrilldownDrawer
                assessmentId={assessmentId}
                type="control"
                targetId={control.controlId}
                label={control.controlLabel}
              />
            </TableCell>
            <TableCell>{control.safeguardsTotal}</TableCell>
            <TableCell>{control.derivedCount}</TableCell>
            <TableCell>{control.manualOverrideCount}</TableCell>
            <TableCell>{control.notMappedCount}</TableCell>
            <TableCell>{formatNumber(control.avgMaturity, 1)}</TableCell>
            <TableCell>{formatNumber(control.avgCoverage, 1)}%</TableCell>
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-sm text-muted-foreground">
              {ptBR.cis.emptyControls}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
