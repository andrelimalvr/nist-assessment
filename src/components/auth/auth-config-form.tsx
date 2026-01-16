"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateAuthConfig } from "@/app/(app)/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthConfig = {
  ssoEnabled: boolean;
  issuerUrl: string | null;
  clientId: string | null;
  scopes: string;
  allowPasswordLogin: boolean;
  domainAllowList: string[];
  enforceSso: boolean;
};

type AuthConfigFormProps = {
  initialConfig: AuthConfig;
};

const initialState = {
  success: false,
  error: null as string | null
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar configuracao"}
    </Button>
  );
}

export default function AuthConfigForm({ initialConfig }: AuthConfigFormProps) {
  const [state, formAction] = useFormState(updateAuthConfig, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          id="ssoEnabled"
          name="ssoEnabled"
          type="checkbox"
          defaultChecked={initialConfig.ssoEnabled}
        />
        <label htmlFor="ssoEnabled" className="text-sm font-medium">
          Habilitar SSO (OIDC)
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Issuer URL</label>
          <Input name="issuerUrl" defaultValue={initialConfig.issuerUrl ?? ""} placeholder="https://" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Client ID</label>
          <Input name="clientId" defaultValue={initialConfig.clientId ?? ""} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Scopes</label>
          <Input name="scopes" defaultValue={initialConfig.scopes} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Domain allow list</label>
          <Input
            name="domainAllowList"
            defaultValue={initialConfig.domainAllowList.join(", ")}
            placeholder="empresa.com, parceiro.com"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            id="allowPasswordLogin"
            name="allowPasswordLogin"
            type="checkbox"
            defaultChecked={initialConfig.allowPasswordLogin}
          />
          Permitir login por senha (credentials)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            id="enforceSso"
            name="enforceSso"
            type="checkbox"
            defaultChecked={initialConfig.enforceSso}
          />
          Forcar SSO para usuarios (break-glass admin permitido)
        </label>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-600">Configuracao salva.</p> : null}

      <SubmitButton />
    </form>
  );
}
