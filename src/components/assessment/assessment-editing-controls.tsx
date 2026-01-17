"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AssessmentReleaseStatus, EditingMode } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/format";

type AssessmentEditingControlsProps = {
  assessmentId: string;
  editingMode: EditingMode;
  releaseStatus: AssessmentReleaseStatus;
  lockedByName?: string | null;
  lockedByEmail?: string | null;
  lockedAt?: string | null;
  lockNote?: string | null;
  canToggle: boolean;
};

const MODE_LABELS: Record<EditingMode, string> = {
  UNLOCKED_FOR_ASSESSORS: "Edicao: Liberada para assessores",
  LOCKED_ADMIN_ONLY: "Edicao: Bloqueada (somente Admin)"
};

export default function AssessmentEditingControls({
  assessmentId,
  editingMode,
  releaseStatus,
  lockedByName,
  lockedByEmail,
  lockedAt,
  lockNote,
  canToggle
}: AssessmentEditingControlsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState(editingMode);

  useEffect(() => {
    setMode(editingMode);
  }, [editingMode]);

  const nextMode =
    mode === EditingMode.UNLOCKED_FOR_ASSESSORS
      ? EditingMode.LOCKED_ADMIN_ONLY
      : EditingMode.UNLOCKED_FOR_ASSESSORS;

  const handleSubmit = async () => {
    const isUnlocking = nextMode === EditingMode.UNLOCKED_FOR_ASSESSORS;
    const endpoint = isUnlocking
      ? `/api/assessments/${assessmentId}/unlock-editing`
      : `/api/assessments/${assessmentId}/editing-mode`;
    const method = isUnlocking ? "POST" : "PATCH";
    const payload = isUnlocking ? { note } : { editingMode: nextMode, note };

    setIsSaving(true);
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: "Erro ao atualizar edição",
        description: data.error || "Nao foi possivel atualizar o modo de edicao.",
        variant: "destructive"
      });
      return;
    }

    setMode(nextMode);
    setOpen(false);
    toast({
      title: "Modo de edicao atualizado",
      description:
        nextMode === EditingMode.UNLOCKED_FOR_ASSESSORS
          ? "Edicao liberada para assessores."
          : "Edicao bloqueada para assessores."
    });
    router.refresh();
  };

  const badgeClass =
    mode === EditingMode.UNLOCKED_FOR_ASSESSORS
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700";

  const actor =
    lockedByName || lockedByEmail
      ? `${lockedByName ?? ""}${lockedByName && lockedByEmail ? " - " : ""}${lockedByEmail ?? ""}`
      : null;

  const unlockWarning =
    mode === EditingMode.LOCKED_ADMIN_ONLY &&
    (releaseStatus === AssessmentReleaseStatus.APPROVED ||
      releaseStatus === AssessmentReleaseStatus.IN_REVIEW);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={badgeClass}>{MODE_LABELS[mode]}</Badge>
        {canToggle ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {mode === EditingMode.UNLOCKED_FOR_ASSESSORS ? "Bloquear edicao" : "Liberar edicao"}
          </Button>
        ) : null}
      </div>
      {mode === EditingMode.LOCKED_ADMIN_ONLY ? (
        <div className="text-xs text-muted-foreground">
          {actor ? <p>Bloqueado por {actor}.</p> : null}
          {lockedAt ? <p>Em {formatDateTime(new Date(lockedAt))}.</p> : null}
          {lockNote ? <p>Nota: {lockNote}</p> : null}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteracao</DialogTitle>
            <DialogDescription>
              Informe um motivo/nota opcional para registrar a mudanca de edicao.
              {unlockWarning
                ? " Ao liberar, uma nova revisao rascunho sera criada."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo/Nota</label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
