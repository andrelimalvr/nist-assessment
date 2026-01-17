"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DrilldownTask = {
  id: string;
  taskId: string;
  taskName: string;
  groupId: string;
  status: string;
  maturity: number;
  owner: string | null;
};

type DrilldownEvidence = {
  id: string;
  taskId: string;
  description: string;
  reviewStatus: string;
  link: string | null;
  owner: string | null;
};

type DrilldownMapping = {
  id: string;
  ssdfTaskId: string;
  cisControlId: string | null;
  cisSafeguardId: string | null;
  mappingType: string;
};

type DrilldownData = {
  tasks: DrilldownTask[];
  evidences: DrilldownEvidence[];
  mappings: DrilldownMapping[];
};

type DrilldownDrawerProps = {
  assessmentId: string;
  type: "group" | "control";
  targetId: string;
  label: string;
  className?: string;
};

export default function DrilldownDrawer({
  assessmentId,
  type,
  targetId,
  label,
  className
}: DrilldownDrawerProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DrilldownData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setData(null);

    const params = new URLSearchParams();
    if (type === "group") params.set("groupId", targetId);
    if (type === "control") params.set("controlId", targetId);

    fetch(`/api/assessments/${assessmentId}/drilldown?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Erro ao carregar dados.");
        }
        return response.json();
      })
      .then((payload: DrilldownData) => {
        setData(payload);
      })
      .catch((err) => {
        setError(err.message || "Erro ao carregar dados.");
      })
      .finally(() => setLoading(false));
  }, [open, assessmentId, targetId, type]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "text-left text-primary hover:underline"}
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fixed !right-0 !top-0 h-full w-[92vw] max-w-3xl !translate-x-0 !translate-y-0 !left-auto rounded-none p-6">
          <DialogHeader>
            <DialogTitle>Detalhes - {label}</DialogTitle>
          </DialogHeader>
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {data ? (
            <div className="space-y-6 overflow-y-auto pr-2">
              <div>
                <h3 className="text-sm font-semibold">Tarefas relacionadas</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Maturidade</TableHead>
                      <TableHead>Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-semibold">{task.groupId}</TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">{task.taskId}</div>
                          <div className="font-medium">{task.taskName}</div>
                        </TableCell>
                        <TableCell>{task.status}</TableCell>
                        <TableCell>{task.maturity}</TableCell>
                        <TableCell>{task.owner || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {data.tasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          Nenhuma tarefa encontrada.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Evidencias</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.evidences.map((evidence) => (
                      <TableRow key={evidence.id}>
                        <TableCell className="font-semibold">{evidence.taskId}</TableCell>
                        <TableCell>{evidence.description}</TableCell>
                        <TableCell>{evidence.reviewStatus}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{evidence.link || "-"}</TableCell>
                        <TableCell>{evidence.owner || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {data.evidences.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          Nenhuma evidencia encontrada.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Mapeamentos CIS</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Controle</TableHead>
                      <TableHead>Salvaguarda</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-semibold">{mapping.ssdfTaskId}</TableCell>
                        <TableCell>{mapping.cisControlId || "-"}</TableCell>
                        <TableCell>{mapping.cisSafeguardId || "-"}</TableCell>
                        <TableCell>{mapping.mappingType}</TableCell>
                      </TableRow>
                    ))}
                    {data.mappings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">
                          Nenhum mapeamento encontrado.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
