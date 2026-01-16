import { EvidenceType, TaskStatus } from "@prisma/client";

export const statusOptions = [
  { value: TaskStatus.NAO_INICIADO, label: "Nao iniciado" },
  { value: TaskStatus.EM_ANDAMENTO, label: "Em andamento" },
  { value: TaskStatus.IMPLEMENTADO, label: "Implementado" },
  { value: TaskStatus.NA, label: "N/A" }
];

export const statusLabels = Object.fromEntries(
  statusOptions.map((status) => [status.value, status.label])
) as Record<TaskStatus, string>;

export const evidenceTypeOptions = [
  { value: EvidenceType.DOCUMENTO, label: "Documento" },
  { value: EvidenceType.TICKET, label: "Ticket" },
  { value: EvidenceType.URL, label: "URL" },
  { value: EvidenceType.PRINT, label: "Print" },
  { value: EvidenceType.PIPELINE, label: "Pipeline" },
  { value: EvidenceType.OUTRO, label: "Outro" }
];
