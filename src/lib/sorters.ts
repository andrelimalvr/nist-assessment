export type SortDirection = "asc" | "desc";

const SSDF_GROUP_ORDER: Record<string, number> = {
  PO: 1,
  PS: 2,
  PW: 3,
  RV: 4
};

export function compareNumbers(a: number, b: number) {
  return a - b;
}

export function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}

function toInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareControlId(a: string, b: string) {
  return compareNumbers(toInt(a), toInt(b));
}

export function parseSafeguardId(value: string) {
  const [major, minor] = value.split(".");
  return [toInt(major), toInt(minor ?? "0")];
}

export function compareSafeguardId(a: string, b: string) {
  const [aMajor, aMinor] = parseSafeguardId(a);
  const [bMajor, bMinor] = parseSafeguardId(b);
  if (aMajor !== bMajor) {
    return compareNumbers(aMajor, bMajor);
  }
  return compareNumbers(aMinor, bMinor);
}

export function parseSsdfId(value: string) {
  const parts = value.split(".");
  const prefix = (parts[0] || "").toUpperCase();
  const major = toInt(parts[1] || "0");
  const minor = toInt(parts[2] || "0");
  return { prefix, major, minor };
}

export function compareSsdfId(a: string, b: string) {
  const parsedA = parseSsdfId(a);
  const parsedB = parseSsdfId(b);
  const prefixOrderA = SSDF_GROUP_ORDER[parsedA.prefix] ?? 99;
  const prefixOrderB = SSDF_GROUP_ORDER[parsedB.prefix] ?? 99;
  if (prefixOrderA !== prefixOrderB) {
    return compareNumbers(prefixOrderA, prefixOrderB);
  }
  if (parsedA.major !== parsedB.major) {
    return compareNumbers(parsedA.major, parsedB.major);
  }
  if (parsedA.minor !== parsedB.minor) {
    return compareNumbers(parsedA.minor, parsedB.minor);
  }
  return compareStrings(a, b);
}

export function compareSsdfGroup(a: string, b: string) {
  const orderA = SSDF_GROUP_ORDER[a] ?? 99;
  const orderB = SSDF_GROUP_ORDER[b] ?? 99;
  if (orderA !== orderB) {
    return compareNumbers(orderA, orderB);
  }
  return compareStrings(a, b);
}

export function comparePercentString(a: string, b: string) {
  const parse = (value: string) => {
    const normalized = value.replace("%", "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return compareNumbers(parse(a), parse(b));
}

export function applySortDirection(result: number, direction: SortDirection) {
  return direction === "asc" ? result : -result;
}
