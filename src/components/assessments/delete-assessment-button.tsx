"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type DeleteAssessmentButtonProps = {
  assessmentId: string;
  assessmentName: string;
  organizationName: string;
};

type AssessmentCounts = {
  responsesCount: number;
  evidencesCount: number;
  mappingsCount: number;
};

export default function DeleteAssessmentButton({
  assessmentId,
  assessmentName,
  organizationName
}: DeleteAssessmentButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<AssessmentCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setCounts(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    fetch(`/api/assessments/${assessmentId}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Erro ao carregar dados.");
        }
        return response.json();
      })
      .then((data) => {
        setCounts({
          responsesCount: data.responsesCount ?? 0,
          evidencesCount: data.evidencesCount ?? 0,
          mappingsCount: data.mappingsCount ?? 0
        });
      })
      .catch((err) => {
        setError(err.message || "Erro ao carregar dados.");
      })
      .finally(() => setIsLoading(false));
  }, [open, assessmentId]);

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    const response = await fetch(`/api/assessments/${assessmentId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload?.error || "Erro ao excluir assessment.";
      setError(message);
      toast({ title: "Erro ao excluir assessment", description: message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    toast({ title: "Assessment excluido com sucesso" });
    setOpen(false);
    setIsLoading(false);
    router.refresh();
  };

  const countsLabel = counts
    ? `Respostas: ${counts.responsesCount} | Evidencias: ${counts.evidencesCount} | Mapeamentos: ${counts.mappingsCount}`
    : "Carregando contagem...";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir assessment?</AlertDialogTitle>
          <AlertDialogDescription>
            Este assessment possui dados associados (tarefas respondidas, evidencias, mapeamentos e resultados CIS).
            Tem certeza que deseja excluir?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Empresa: {organizationName}</p>
          <p>Assessment: {assessmentName}</p>
          <p>{countsLabel}</p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
            disabled={isLoading}
          >
            {isLoading ? "Excluindo..." : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
