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

type DeleteUserButtonProps = {
  userId: string;
  userName: string;
  userEmail: string;
  currentUserId?: string | null;
};

export default function DeleteUserButton({
  userId,
  userName,
  userEmail,
  currentUserId
}: DeleteUserButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

  const handleDelete = async () => {
    if (currentUserId && currentUserId === userId) {
      const message = "Voce nao pode excluir seu proprio usuario.";
      setError(message);
      toast({ title: "Erro ao excluir usuario", description: message, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload?.error || "Erro ao excluir usuario.";
      setError(message);
      toast({ title: "Erro ao excluir usuario", description: message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    toast({ title: "Usuario excluido com sucesso" });
    setOpen(false);
    setIsLoading(false);
    router.refresh();
  };

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
          <AlertDialogTitle>Excluir usuario?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o usuario {userName} ({userEmail})? Esta acao nao pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
