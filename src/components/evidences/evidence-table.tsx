"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { EvidenceReviewStatus } from "@prisma/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { evidenceTypeOptions } from "@/lib/ssdf";
import HistoryDrawer from "@/components/history/history-drawer";

export type EvidenceRow = {
  id: string;
  taskId: string;
  taskName: string;
  type: string;
  reviewStatus: string;
  description: string;
  link: string | null;
  owner: string | null;
  date: string | null;
  validUntil: string | null;
  dateValue: number;
  validUntilValue: number;
  notes?: string | null;
};

type SortKey = "taskId" | "type" | "description" | "owner" | "date" | "validUntil";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type EvidenceTableProps = {
  rows: EvidenceRow[];
  canEdit: boolean;
};

const HISTORY_FIELDS = [
  { value: "type", label: "Tipo" },
  { value: "reviewStatus", label: "Status de revisao" },
  { value: "description", label: "Evidencia" },
  { value: "link", label: "Link/ID" },
  { value: "owner", label: "Owner" },
  { value: "date", label: "Data" },
  { value: "validUntil", label: "Validade" },
  { value: "notes", label: "Observacoes" }
];

const REVIEW_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado"
};

export default function EvidenceTable({ rows, canEdit }: EvidenceTableProps) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({ key: "date", direction: "desc" });
  const [selected, setSelected] = useState<EvidenceRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      description: String(formData.get("description") || ""),
      type: String(formData.get("type") || ""),
      reviewStatus: String(formData.get("reviewStatus") || EvidenceReviewStatus.PENDING),
      link: String(formData.get("link") || ""),
      owner: String(formData.get("owner") || ""),
      date: String(formData.get("date") || ""),
      validUntil: String(formData.get("validUntil") || ""),
      notes: String(formData.get("notes") || ""),
      reason: String(formData.get("reason") || "")
    };

    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/evidences/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setIsSaving(false);

    if (!response.ok) {
      setError("Erro ao salvar evidencia.");
      return;
    }

    setSelected(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
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
          <TableHead>Revisao</TableHead>
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
          <TableHead>Acoes</TableHead>
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
            <TableCell>{REVIEW_LABELS[evidence.reviewStatus] ?? evidence.reviewStatus}</TableCell>
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
            <TableCell className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit}
                onClick={() => setSelected(evidence)}
              >
                Editar
              </Button>
              <HistoryDrawer
                title={`Historico ${evidence.taskId}`}
                fetchUrl={`/api/evidences/${evidence.id}/history`}
                fields={HISTORY_FIELDS}
                triggerLabel="Historico"
              />
            </TableCell>
            </TableRow>
          ))}
          {sortedRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                Nenhuma evidencia registrada.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected ? (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar evidencia</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Descricao</label>
                <Textarea name="description" defaultValue={selected.description} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <select
                  name="type"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  defaultValue={selected.type}
                  required
                >
                  {evidenceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status de revisao</label>
                <select
                  name="reviewStatus"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  defaultValue={selected.reviewStatus}
                >
                  <option value={EvidenceReviewStatus.PENDING}>Pendente</option>
                  <option value={EvidenceReviewStatus.APPROVED}>Aprovado</option>
                  <option value={EvidenceReviewStatus.REJECTED}>Rejeitado</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Owner</label>
                <Input name="owner" defaultValue={selected.owner || ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data</label>
                <Input name="date" type="date" defaultValue={selected.date?.slice(0, 10) || ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Validade</label>
                <Input name="validUntil" type="date" defaultValue={selected.validUntil?.slice(0, 10) || ""} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Link/ID</label>
                <Input name="link" defaultValue={selected.link || ""} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Observacoes</label>
                <Textarea name="notes" defaultValue={selected.notes || ""} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Motivo da alteracao</label>
                <Textarea name="reason" placeholder="Opcional" />
              </div>
              {error ? (
                <p className="md:col-span-2 text-sm text-red-600">{error}</p>
              ) : null}
              <DialogFooter className="md:col-span-2">
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
