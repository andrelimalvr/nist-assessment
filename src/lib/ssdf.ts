import { EvidenceType, SsdfStatus } from "@prisma/client";

export const MAX_MATURITY_LEVEL = 3;

export const statusOptions = [
  { value: SsdfStatus.NOT_STARTED, label: "Nao iniciado" },
  { value: SsdfStatus.IN_PROGRESS, label: "Em andamento" },
  { value: SsdfStatus.IMPLEMENTED, label: "Implementado" },
  { value: SsdfStatus.NOT_APPLICABLE, label: "Nao aplicavel" }
];

export const statusLabels = Object.fromEntries(
  statusOptions.map((status) => [status.value, status.label])
) as Record<SsdfStatus, string>;

export const evidenceTypeOptions = [
  { value: EvidenceType.DOCUMENTO, label: "Documento" },
  { value: EvidenceType.TICKET, label: "Ticket" },
  { value: EvidenceType.URL, label: "URL" },
  { value: EvidenceType.PRINT, label: "Print" },
  { value: EvidenceType.PIPELINE, label: "Pipeline" },
  { value: EvidenceType.OUTRO, label: "Outro" }
];

export function isApplicable(status: SsdfStatus | string) {
  return status !== SsdfStatus.NOT_APPLICABLE;
}

export function parseEvidenceLinks(value?: string | string[] | null) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (!value) return [];
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatEvidenceLinks(value?: string[] | null) {
  if (!value || value.length === 0) return "";
  return value.join("\n");
}
