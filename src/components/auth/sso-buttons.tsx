"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type ProviderInfo = {
  id: string;
  name: string;
};

export default function SsoButtons() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    getProviders().then((result) => {
      if (!result) return;
      const list = Object.values(result).filter((provider) => provider.id !== "credentials");
      setProviders(list as ProviderInfo[]);
    });
  }, []);

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">ou</span>
        <Separator className="flex-1" />
      </div>
      <div className="space-y-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => signIn(provider.id, { callbackUrl: "/dashboard" })}
          >
            Entrar com {provider.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
