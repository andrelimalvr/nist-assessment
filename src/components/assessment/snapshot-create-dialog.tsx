"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const payloadSchema = z.object({
  label: z.string().trim().min(1).max(80).optional()
});

type SnapshotCreateDialogProps = {
  assessmentId: string;
};

export default function SnapshotCreateDialog({ assessmentId }: SnapshotCreateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = payloadSchema.safeParse({ label: label || undefined });
    if (!parsed.success) {
      setError("Informe um label com ate 80 caracteres.");
      return;
    }

    setIsSaving(true);
    setError(null);
    const response = await fetch(`/api/assessments/${assessmentId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Nao foi possivel criar snapshot.");
      return;
    }

    toast({ title: "Snapshot criado com sucesso" });
    setLabel("");
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Criar snapshot
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo snapshot</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Label (opcional)</label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Ex: Baseline, Q1 Review"
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Criar snapshot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
