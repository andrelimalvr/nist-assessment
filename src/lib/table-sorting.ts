import {
  applySortDirection,
  compareCisStatus,
  compareControlId,
  compareImplementationGroup,
  compareNumbers,
  compareSafeguardId,
  compareSsdfGroup,
  compareSsdfId,
  compareStrings,
  compareStringsLocale,
  SortDirection
} from "@/lib/sorters";

export type SortType =
  | "number"
  | "string"
  | "stringLocale"
  | "ssdfId"
  | "safeguardId"
  | "controlId"
  | "ssdfGroup"
  | "ig"
  | "cisStatus";

export type SortConfig<Row> = Record<
  string,
  { type: SortType; accessor: (row: Row) => string | number | null | undefined; locale?: string }
>;

function compareOptional<T>(
  a: T | null | undefined,
  b: T | null | undefined,
  compareFn: (valueA: T, valueB: T) => number
) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return compareFn(a, b);
}

function compareByType(
  type: SortType,
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  locale: string
) {
  switch (type) {
    case "number":
      return compareOptional(
        a == null ? null : Number(a),
        b == null ? null : Number(b),
        compareNumbers
      );
    case "string":
      return compareOptional(a == null ? null : String(a), b == null ? null : String(b), compareStrings);
    case "stringLocale":
      return compareOptional(
        a == null ? null : String(a),
        b == null ? null : String(b),
        (valueA, valueB) => compareStringsLocale(valueA, valueB, locale)
      );
    case "ssdfId":
      return compareOptional(
        a == null ? null : String(a),
        b == null ? null : String(b),
        compareSsdfId
      );
    case "safeguardId":
      return compareOptional(
        a == null ? null : String(a),
        b == null ? null : String(b),
        compareSafeguardId
      );
    case "controlId":
      return compareOptional(
        a == null ? null : String(a),
        b == null ? null : String(b),
        compareControlId
      );
    case "ssdfGroup":
      return compareOptional(
        a == null ? null : String(a),
        b == null ? null : String(b),
        compareSsdfGroup
      );
    case "ig":
      return compareOptional(
        a == null ? null : String(a),
        b == null ? null : String(b),
        compareImplementationGroup
      );
    case "cisStatus":
      return compareOptional(
        a == null ? null : String(a),
        b == null ? null : String(b),
        compareCisStatus
      );
    default:
      return 0;
  }
}

export function sortRows<Row>(
  rows: Row[],
  sortKey: string,
  direction: SortDirection,
  config: SortConfig<Row>,
  defaultLocale = "pt-BR"
) {
  const entry = config[sortKey];
  if (!entry) return rows;

  const sorted = [...rows];
  sorted.sort((rowA, rowB) => {
    const valueA = entry.accessor(rowA);
    const valueB = entry.accessor(rowB);
    const result = compareByType(entry.type, valueA, valueB, entry.locale ?? defaultLocale);
    return applySortDirection(result, direction);
  });
  return sorted;
}
