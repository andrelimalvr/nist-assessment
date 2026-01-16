"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortHeader from "@/components/table/sort-header";
import {
  applySortDirection,
  compareControlId,
  compareNumbers,
  compareSafeguardId,
  compareSsdfGroup,
  compareSsdfId,
  compareStrings,
  SortDirection
} from "@/lib/sorters";
import { Button } from "@/components/ui/button";

export type MappingRow = {
  id: string;
  ssdfTaskId: string;
  ssdfTaskName: string;
  groupId: string;
  cisControlId: string | null;
  cisControlName: string | null;
  cisSafeguardId: string | null;
  cisSafeguardName: string | null;
  mappingType: string;
  weight: number;
  notes: string | null;
  canEdit: boolean;
};

type SortKey =
  | "ssdfTaskId"
  | "groupId"
  | "cisControlId"
  | "cisSafeguardId"
  | "mappingType"
  | "weight"
  | "notes";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

function compareOptionalId(
  a: string | null,
  b: string | null,
  comparator: (x: string, y: string) => number
) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return comparator(a, b);
}

export default function MappingsTable({ rows }: { rows: MappingRow[] }) {
  const [sort, setSort] = useState<SortState>({ key: "ssdfTaskId", direction: "asc" });

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let result = 0;
      switch (sort.key) {
        case "ssdfTaskId":
          result = compareSsdfId(a.ssdfTaskId, b.ssdfTaskId);
          break;
        case "groupId":
          result = compareSsdfGroup(a.groupId, b.groupId);
          break;
        case "cisControlId":
          result = compareOptionalId(a.cisControlId, b.cisControlId, compareControlId);
          break;
        case "cisSafeguardId":
          result = compareOptionalId(a.cisSafeguardId, b.cisSafeguardId, compareSafeguardId);
          break;
        case "mappingType":
          result = compareStrings(a.mappingType, b.mappingType);
          break;
        case "weight":
          result = compareNumbers(a.weight, b.weight);
          break;
        case "notes":
          result = compareStrings(a.notes ?? "", b.notes ?? "");
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
              label="SSDF"
              active={sort.key === "ssdfTaskId"}
              direction={sort.direction}
              onClick={() => toggleSort("ssdfTaskId")}
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
              label="CIS Control"
              active={sort.key === "cisControlId"}
              direction={sort.direction}
              onClick={() => toggleSort("cisControlId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="CIS Safeguard"
              active={sort.key === "cisSafeguardId"}
              direction={sort.direction}
              onClick={() => toggleSort("cisSafeguardId")}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              label="Tipo"
              active={sort.key === "mappingType"}
              direction={sort.direction}
              onClick={() => toggleSort("mappingType")}
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
              label="Notas"
              active={sort.key === "notes"}
              direction={sort.direction}
              onClick={() => toggleSort("notes")}
            />
          </TableHead>
          <TableHead>Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((mapping) => (
          <TableRow key={mapping.id}>
            <TableCell>
              <div className="text-xs text-muted-foreground">{mapping.ssdfTaskId}</div>
              <div className="font-medium">{mapping.ssdfTaskName}</div>
            </TableCell>
            <TableCell>{mapping.groupId}</TableCell>
            <TableCell>
              {mapping.cisControlId && mapping.cisControlName
                ? `${mapping.cisControlId} - ${mapping.cisControlName}`
                : mapping.cisSafeguardId && mapping.cisControlName
                  ? `${mapping.cisControlId ?? ""} - ${mapping.cisControlName}`
                  : "-"}
            </TableCell>
            <TableCell>
              {mapping.cisSafeguardId && mapping.cisSafeguardName
                ? `${mapping.cisSafeguardId} - ${mapping.cisSafeguardName}`
                : "-"}
            </TableCell>
            <TableCell>{mapping.mappingType}</TableCell>
            <TableCell>{mapping.weight}</TableCell>
            <TableCell>{mapping.notes || "-"}</TableCell>
            <TableCell>
              {mapping.canEdit ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/mappings/${mapping.id}`}>Editar</Link>
                </Button>
              ) : (
                "-"
              )}
            </TableCell>
          </TableRow>
        ))}
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-sm text-muted-foreground">
              Nenhum mapeamento cadastrado.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
