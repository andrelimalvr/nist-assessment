"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Role } from "@prisma/client";
import { createUser } from "@/app/(app)/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrganizationOption = {
  id: string;
  name: string;
};

type CreateUserFormProps = {
  organizations: OrganizationOption[];
};

const initialState = {
  success: false,
  error: null as string | null,
  tempPassword: null as string | null,
  tempPasswordGenerated: false
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando..." : "Criar usuario"}
    </Button>
  );
}

export default function CreateUserForm({ organizations }: CreateUserFormProps) {
  const [state, formAction] = useFormState(createUser, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome</label>
          <Input name="name" placeholder="Nome completo" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input name="email" type="email" placeholder="usuario@empresa.com" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Senha temporaria</label>
          <Input name="password" type="password" placeholder="Deixe em branco para gerar" />
          <p className="text-xs text-muted-foreground">No primeiro login sera obrigatorio alterar.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Role</label>
          <select
            name="role"
            className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            required
          >
            <option value={Role.ADMIN}>Admin</option>
            <option value={Role.ASSESSOR}>Assessor</option>
            <option value={Role.VIEWER}>Viewer</option>
          </select>
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-sm font-medium">Organizacoes (para Assessor/Viewer)</label>
          {organizations.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {organizations.map((org) => (
                <label key={org.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="organizationIds" value={org.id} />
                  {org.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cadastre organizacoes antes.</p>
          )}
        </div>
        <div className="md:col-span-2">
          <SubmitButton />
        </div>
      </form>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      {state.success && state.tempPasswordGenerated && state.tempPassword ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Senha temporaria gerada:</p>
          <p className="mt-1 font-mono text-base">{state.tempPassword}</p>
          <p className="mt-2 text-xs">Anote esta senha, ela sera exibida apenas uma vez.</p>
        </div>
      ) : null}

      {state.success && !state.tempPasswordGenerated ? (
        <p className="text-sm text-emerald-600">Usuario criado com senha definida pelo admin.</p>
      ) : null}
    </div>
  );
}
