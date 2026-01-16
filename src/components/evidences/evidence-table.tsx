"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import {
  applySortDirection,
  compareNumbers,
  compareSsdfId,
  compareStrings,
  SortDirection
} from "@/lib/sorters";
import { formatDate } from "@/lib/format";

export type EvidenceRow = {
  id: string;
  taskId: string;
  taskName: string;
  type: string;
  description: string;
  link: string | null;
  owner: string | null;
  date: string | null;
  validUntil: string | null;
  dateValue: number;
  validUntilValue: number;
};

type SortKey = "taskId" | "type" | "description" | "owner" | "date" | "validUntil";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

export default function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  const [sort, setSort] = useState<SortState>({ key: "date", direction: "desc" });

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let result = 0;
      switch (sort.key) {
        case "taskId":
          result = compareSsdfId(a.taskId, b.taskId);
          break;
        case "type":
          result = compareStrings(a.type, b.type);
          break;
        case "description":
          result = compareStrings(a.description, b.description);
          break;
        case "owner":
          result = compareStrings(a.owner ?? "", b.owner ?? "");
          break;
        case "date":
          result = compareNumbers(a.dateValue, b.dateValue);
          break;
        case "validUntil":
          result = compareNumbers(a.validUntilValue, b.validUntilValue);
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
              label="Tarefa"
              active={sort.key === "taskId"}
              direction={sort.direction}
              onClick={() => toggleSort("taskId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Tipo"
              active={sort.key === "type"}
              direction={sort.direction}
              onClick={() => toggleSort("type")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Evidencia"
              active={sort.key === "description"}
              direction={sort.direction}
              onClick={() => toggleSort("description")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Owner"
              active={sort.key === "owner"}
              direction={sort.direction}
              onClick={() => toggleSort("owner")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Data"
              active={sort.key === "date"}
              direction={sort.direction}
              onClick={() => toggleSort("date")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Validade"
              active={sort.key === "validUntil"}
              direction={sort.direction}
              onClick={() => toggleSort("validUntil")}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((evidence) => (
          <TableRow key={evidence.id}>
            <TableCell>
              <div className="text-xs text-muted-foreground">{evidence.taskId}</div>
              <div className="font-medium">{evidence.taskName}</div>
            </TableCell>
            <TableCell>{evidence.type}</TableCell>
            <TableCell>
              <div className="font-medium">{evidence.description}</div>
              {evidence.link ? (
                <a
                  href={evidence.link}
                  className="text-xs text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {evidence.link}
                </a>
              ) : null}
            </TableCell>
            <TableCell>{evidence.owner || "-"}</TableCell>
            <TableCell>{formatDate(evidence.date ? new Date(evidence.date) : null)}</TableCell>
            <TableCell>{formatDate(evidence.validUntil ? new Date(evidence.validUntil) : null)}</TableCell>
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-sm text-muted-foreground">
              Nenhuma evidencia registrada.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
