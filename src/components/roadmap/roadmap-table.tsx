"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import {
  applySortDirection,
  compareNumbers,
  compareSsdfGroup,
  compareSsdfId,
  compareStrings,
  SortDirection
} from "@/lib/sorters";

export type RoadmapRow = {
  id: string;
  priority: number;
  groupId: string;
  taskId: string;
  taskName: string;
  gap: number;
  weight: number;
  statusLabel: string;
  owner: string | null;
};

type SortKey = "priority" | "groupId" | "taskId" | "gap" | "weight" | "status" | "owner";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

export default function RoadmapTable({ rows }: { rows: RoadmapRow[] }) {
  const [sort, setSort] = useState<SortState>({ key: "priority", direction: "desc" });

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let result = 0;
      switch (sort.key) {
        case "priority":
          result = compareNumbers(a.priority, b.priority);
          break;
        case "groupId":
          result = compareSsdfGroup(a.groupId, b.groupId);
          break;
        case "taskId":
          result = compareSsdfId(a.taskId, b.taskId);
          break;
        case "gap":
          result = compareNumbers(a.gap, b.gap);
          break;
        case "weight":
          result = compareNumbers(a.weight, b.weight);
          break;
        case "status":
          result = compareStrings(a.statusLabel, b.statusLabel);
          break;
        case "owner":
          result = compareStrings(a.owner ?? "", b.owner ?? "");
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
              label="Prioridade"
              active={sort.key === "priority"}
              direction={sort.direction}
              onClick={() => toggleSort("priority")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Grupo"
              active={sort.key === "groupId"}
              direction={sort.direction}
              onClick={() => toggleSort("groupId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Tarefa"
              active={sort.key === "taskId"}
              direction={sort.direction}
              onClick={() => toggleSort("taskId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Gap"
              active={sort.key === "gap"}
              direction={sort.direction}
              onClick={() => toggleSort("gap")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Peso"
              active={sort.key === "weight"}
              direction={sort.direction}
              onClick={() => toggleSort("weight")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Status"
              active={sort.key === "status"}
              direction={sort.direction}
              onClick={() => toggleSort("status")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Responsavel"
              active={sort.key === "owner"}
              direction={sort.direction}
              onClick={() => toggleSort("owner")}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-semibold">{item.priority}</TableCell>
            <TableCell>{item.groupId}</TableCell>
            <TableCell>
              <div className="text-xs text-muted-foreground">{item.taskId}</div>
              <div className="font-medium">{item.taskName}</div>
            </TableCell>
            <TableCell>{item.gap}</TableCell>
            <TableCell>{item.weight}</TableCell>
            <TableCell>{item.statusLabel}</TableCell>
            <TableCell>{item.owner || "-"}</TableCell>
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-sm text-muted-foreground">
              Nenhum item encontrado.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
