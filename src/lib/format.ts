import { format } from "date-fns";

export function formatDate(date?: Date | null) {
  if (!date) return "-";
  return format(date, "yyyy-MM-dd");
}

export function formatPercent(value: number, decimals = 0) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${(safe * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 0) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(decimals);
}
