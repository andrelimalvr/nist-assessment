"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { getPasswordValidationError } from "@/lib/password";

const SUCCESS_MESSAGE = "Senha atualizada com sucesso";

type ChangePasswordFormProps = {
  email: string;
};

export default function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const { update } = useSession();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (newPassword !== confirmPassword) {
      setError("A nova senha e a confirmacao nao conferem.");
      return;
    }

    const policyError = getPasswordValidationError(newPassword, email);
    if (policyError) {
      setError(policyError);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error || "Erro ao atualizar senha.");
        return;
      }

      await update({ mustChangePassword: false });
      toast({ title: SUCCESS_MESSAGE });
      event.currentTarget.reset();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input id="newPassword" name="newPassword" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Atualizando..." : "Alterar senha"}
      </Button>
    </form>
  );
}
