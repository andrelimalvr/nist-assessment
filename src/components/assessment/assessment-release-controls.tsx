"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AssessmentReleaseStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<AssessmentReleaseStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisao",
  APPROVED: "Aprovada"
};

type ReleaseControlsProps = {
  assessmentId: string;
  status: AssessmentReleaseStatus;
  canSubmit: boolean;
  canApprove: boolean;
};

type ReleaseAction = "submit" | "approve" | "reject";

export default function AssessmentReleaseControls({
  assessmentId,
  status,
  canSubmit,
  canApprove
}: ReleaseControlsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ReleaseAction | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAction = (nextAction: ReleaseAction) => {
    setAction(nextAction);
    setNotes("");
    setError(null);
    setOpen(true);
  };

  const submitAction = async () => {
    if (!action) return;
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/assessments/${assessmentId}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Erro ao atualizar status.");
      return;
    }

    setOpen(false);
    setAction(null);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">
        Revisao: <span className="font-semibold text-foreground">{STATUS_LABELS[status]}</span>
      </span>
      {status === AssessmentReleaseStatus.DRAFT && canSubmit ? (
        <Button size="sm" onClick={() => startAction("submit")}>
          Enviar para revisao
        </Button>
      ) : null}
      {status === AssessmentReleaseStatus.IN_REVIEW && canApprove ? (
        <>
          <Button size="sm" onClick={() => startAction("approve")}>
            Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={() => startAction("reject")}>
            Rejeitar
          </Button>
        </>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar acao</DialogTitle>
            <DialogDescription>
              Informe o motivo/nota para registrar na trilha de auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nota</label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Descreva o motivo"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitAction} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
