"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type DeleteOrganizationButtonProps = {
  organizationId: string;
  organizationName: string;
};

export default function DeleteOrganizationButton({
  organizationId,
  organizationName
}: DeleteOrganizationButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assessmentCount, setAssessmentCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setAssessmentCount(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    fetch(`/api/organizations/${organizationId}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Erro ao carregar dados.");
        }
        return response.json();
      })
      .then((data) => {
        setAssessmentCount(data.assessmentCount ?? 0);
      })
      .catch((err) => {
        setError(err.message || "Erro ao carregar dados.");
      })
      .finally(() => setIsLoading(false));
  }, [open, organizationId]);

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    const response = await fetch(`/api/organizations/${organizationId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error || "Erro ao excluir organizacao.");
      setIsLoading(false);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  const countLabel = assessmentCount === null ? "..." : assessmentCount;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta empresa possui {countLabel} assessment(s) associado(s). Tem certeza que deseja excluir?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {organizationName ? (
          <p className="text-sm text-muted-foreground">Empresa: {organizationName}</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isLoading}>
            {isLoading ? "Excluindo..." : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
