"use server";

import { z } from "zod";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/rbac";
import { getAuthConfig, upsertAuthConfig } from "@/lib/auth-config";
import { logFieldChanges } from "@/lib/audit/log";
import { getRequestContext } from "@/lib/audit/request";
import { AuditAction } from "@prisma/client";

const configSchema = z.object({
  ssoEnabled: z.boolean(),
  issuerUrl: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  scopes: z.string().optional().nullable(),
  allowPasswordLogin: z.boolean(),
  enforceSso: z.boolean(),
  domainAllowList: z.array(z.string())
});

type UpdateState = {
  success?: boolean;
  error?: string | null;
};

export async function updateAuthConfig(_: UpdateState, formData: FormData): Promise<UpdateState> {
  const session = await requireAuth([Role.ADMIN]);
  if (!session) {
    return { error: "Nao autorizado" };
  }

  const issuerUrl = String(formData.get("issuerUrl") || "").trim();
  const clientId = String(formData.get("clientId") || "").trim();
  const scopes = String(formData.get("scopes") || "").trim();
  const domainAllowListRaw = String(formData.get("domainAllowList") || "").trim();

  const parsed = configSchema.safeParse({
    ssoEnabled: formData.get("ssoEnabled") === "on",
    issuerUrl: issuerUrl || null,
    clientId: clientId || null,
    scopes: scopes || null,
    allowPasswordLogin: formData.get("allowPasswordLogin") === "on",
    enforceSso: formData.get("enforceSso") === "on",
    domainAllowList: domainAllowListRaw
      ? domainAllowListRaw.split(",").map((item) => item.trim()).filter(Boolean)
      : []
  });

  if (!parsed.success) {
    return { error: "Dados invalidos" };
  }

  if (parsed.data.issuerUrl && !parsed.data.issuerUrl.startsWith("https://")) {
    return { error: "Issuer deve usar https://" };
  }

  const existing = await getAuthConfig();

  const updated = await upsertAuthConfig({
    ssoEnabled: parsed.data.ssoEnabled,
    issuerUrl: parsed.data.issuerUrl,
    clientId: parsed.data.clientId,
    scopes: parsed.data.scopes || "openid profile email",
    allowPasswordLogin: parsed.data.allowPasswordLogin,
    enforceSso: parsed.data.enforceSso,
    domainAllowList: parsed.data.domainAllowList
  });

  await logFieldChanges({
    action: AuditAction.UPDATE,
    entityType: "AuthConfig",
    entityId: updated.id,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: getRequestContext(),
    before: {
      ssoEnabled: existing.ssoEnabled,
      issuerUrl: existing.issuerUrl,
      clientId: existing.clientId,
      scopes: existing.scopes,
      allowPasswordLogin: existing.allowPasswordLogin,
      enforceSso: existing.enforceSso,
      domainAllowList: existing.domainAllowList
    },
    after: {
      ssoEnabled: updated.ssoEnabled,
      issuerUrl: updated.issuerUrl,
      clientId: updated.clientId,
      scopes: updated.scopes,
      allowPasswordLogin: updated.allowPasswordLogin,
      enforceSso: updated.enforceSso,
      domainAllowList: updated.domainAllowList
    },
    fields: [
      "ssoEnabled",
      "issuerUrl",
      "clientId",
      "scopes",
      "allowPasswordLogin",
      "enforceSso",
      "domainAllowList"
    ]
  });

  revalidatePath("/auth");

  return { success: true };
}
