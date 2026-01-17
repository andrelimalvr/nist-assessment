"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SsdfStatus } from "@prisma/client";
import { MAX_MATURITY_LEVEL, formatEvidenceLinks, isApplicable, statusOptions, statusLabels } from "@/lib/ssdf";
import HistoryDrawer from "@/components/history/history-drawer";

export type AssessmentResponseRow = {
  id: string;
  taskId: string;
  taskName: string;
  practiceId: string;
  practiceName: string;
  groupId: string;
  examples?: string | null;
  references?: string | null;
  status: SsdfStatus | string;
  maturityLevel: number;
  targetLevel: number;
  weight: number;
  gap: number;
  priority: number;
  progressWeighted: number;
  owner?: string | null;
  team?: string | null;
  dueDate?: string | null;
  lastReview?: string | null;
  evidenceText?: string | null;
  evidenceLinks?: string[] | null;
  comments?: string | null;
};

type AssessmentTableProps = {
  assessmentId: string;
  responses: AssessmentResponseRow[];
  canEdit: boolean;
};

const HISTORY_FIELDS = [
  { value: "status", label: "Status" },
  { value: "applicable", label: "Aplicavel" },
  { value: "maturityLevel", label: "Maturidade" },
  { value: "targetLevel", label: "Alvo" },
  { value: "weight", label: "Peso" },
  { value: "owner", label: "Responsavel" },
  { value: "team", label: "Area/Time" },
  { value: "dueDate", label: "Prazo" },
  { value: "lastReview", label: "Ultima revisao" },
  { value: "evidenceText", label: "Evidencias" },
  { value: "evidenceLinks", label: "Links adicionais" },
  { value: "comments", label: "Observacoes" }
];

export default function AssessmentTable({
  assessmentId,
  responses,
  canEdit
}: AssessmentTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<AssessmentResponseRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = responses.length;
    const applicable = responses.filter((r) => isApplicable(r.status)).length;
    const implemented = responses.filter(
      (r) => isApplicable(r.status) && r.status === SsdfStatus.IMPLEMENTED
    ).length;
    return { total, applicable, implemented };
  }, [responses]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;

    const formData = new FormData(event.currentTarget);
    const applicable = formData.get("applicable") === "true";
    let status = String(formData.get("status") || SsdfStatus.NOT_STARTED);
    if (!applicable) {
      status = SsdfStatus.NOT_APPLICABLE;
    } else if (status === SsdfStatus.NOT_APPLICABLE) {
      status = SsdfStatus.NOT_STARTED;
    }

    const payload = {
      status,
      maturityLevel: Number(formData.get("maturityLevel")),
      targetLevel: Number(formData.get("targetLevel")),
      weight: Number(formData.get("weight")),
      owner: String(formData.get("owner") || ""),
      team: String(formData.get("team") || ""),
      dueDate: String(formData.get("dueDate") || ""),
      lastReview: String(formData.get("lastReview") || ""),
      evidenceText: String(formData.get("evidenceText") || ""),
      evidenceLinks: String(formData.get("evidenceLinks") || ""),
      comments: String(formData.get("comments") || ""),
      reason: String(formData.get("reason") || "")
    };

    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/assessments/${assessmentId}/responses/${selected.id}` , {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setIsSaving(false);

    if (!response.ok) {
      setError("Erro ao salvar. Verifique os dados e tente novamente.");
      return;
    }

    setSelected(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {summary.applicable} aplicaveis | {summary.implemented} implementadas | {summary.total} tarefas
        </span>
        <span className="text-xs">Clique em "Editar" para atualizar.</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Grupo</TableHead>
            <TableHead>Pratica</TableHead>
            <TableHead>Tarefa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aplicavel</TableHead>
            <TableHead>Maturidade</TableHead>
            <TableHead>Alvo</TableHead>
            <TableHead>Gap</TableHead>
            <TableHead>Peso</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Resp.</TableHead>
            <TableHead>Area/Time</TableHead>
            <TableHead>Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-semibold">{row.groupId}</TableCell>
              <TableCell>
                <div className="text-xs text-muted-foreground">{row.practiceId}</div>
                <div className="font-medium">{row.practiceName}</div>
              </TableCell>
              <TableCell>
                <div className="text-xs text-muted-foreground">{row.taskId}</div>
                <div className="font-medium">{row.taskName}</div>
              </TableCell>
              <TableCell>{statusLabels[row.status as SsdfStatus] ?? row.status}</TableCell>
              <TableCell>{isApplicable(row.status) ? "Sim" : "Nao"}</TableCell>
              <TableCell>{row.maturityLevel}</TableCell>
              <TableCell>{row.targetLevel}</TableCell>
              <TableCell>{row.gap}</TableCell>
              <TableCell>{row.weight}</TableCell>
              <TableCell>{row.priority}</TableCell>
              <TableCell>{row.owner || "-"}</TableCell>
              <TableCell>{row.team || "-"}</TableCell>
              <TableCell className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canEdit}
                  onClick={() => setSelected(row)}
                >
                  Editar
                </Button>
                <HistoryDrawer
                  title={`Historico ${row.taskId}`}
                  fetchUrl={`/api/assessments/${assessmentId}/responses/${row.id}/history`}
                  fields={HISTORY_FIELDS}
                  triggerLabel="Historico"
                />
              </TableCell>
            </TableRow>
          ))}
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
              <DialogTitle>Editar tarefa {selected.taskId}</DialogTitle>
              <DialogDescription>{selected.taskName}</DialogDescription>
            </DialogHeader>
            {(selected.examples || selected.references) && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {selected.examples ? (
                  <p>
                    <span className="font-semibold text-foreground">Exemplos:</span> {selected.examples}
                  </p>
                ) : null}
                {selected.references ? (
                  <p>
                    <span className="font-semibold text-foreground">Referencias:</span> {selected.references}
                  </p>
                ) : null}
              </div>
            )}
            <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Aplicavel?</label>
                <select
                  name="applicable"
                  defaultValue={isApplicable(selected.status) ? "true" : "false"}
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                >
                  <option value="true">Sim</option>
                  <option value="false">Nao</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  name="status"
                  defaultValue={selected.status}
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Maturidade (0-3)</label>
                <Input
                  name="maturityLevel"
                  type="number"
                  min={0}
                  max={MAX_MATURITY_LEVEL}
                  defaultValue={selected.maturityLevel}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alvo (0-3)</label>
                <Input
                  name="targetLevel"
                  type="number"
                  min={0}
                  max={MAX_MATURITY_LEVEL}
                  defaultValue={selected.targetLevel}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Peso (1-5)</label>
                <Input
                  name="weight"
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={selected.weight}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Responsavel</label>
                <Input name="owner" defaultValue={selected.owner || ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Area/Time</label>
                <Input name="team" defaultValue={selected.team || ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prazo</label>
                <Input name="dueDate" type="date" defaultValue={selected.dueDate || ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ultima revisao</label>
                <Input name="lastReview" type="date" defaultValue={selected.lastReview || ""} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Evidencias / links</label>
                <Textarea name="evidenceText" defaultValue={selected.evidenceText || ""} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Links adicionais</label>
                <Textarea
                  name="evidenceLinks"
                  defaultValue={formatEvidenceLinks(selected.evidenceLinks)}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Observacoes</label>
                <Textarea name="comments" defaultValue={selected.comments || ""} />
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
