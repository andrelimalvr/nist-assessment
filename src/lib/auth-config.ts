import { prisma } from "@/lib/prisma";

type AuthConfigDefaults = {
  ssoEnabled: boolean;
  issuerUrl: string | null;
  clientId: string | null;
  scopes: string;
  allowPasswordLogin: boolean;
  domainAllowList: string[];
  enforceSso: boolean;
};

const defaults: AuthConfigDefaults = {
  ssoEnabled: false,
  issuerUrl: null,
  clientId: null,
  scopes: "openid profile email",
  allowPasswordLogin: true,
  domainAllowList: [],
  enforceSso: false
};

export async function getAuthConfig() {
  const config = await prisma.authConfig.findUnique({ where: { key: "default" } });
  if (!config) {
    return { ...defaults };
  }
  return {
    ssoEnabled: config.ssoEnabled,
    issuerUrl: config.issuerUrl,
    clientId: config.clientId,
    scopes: config.scopes,
    allowPasswordLogin: config.allowPasswordLogin,
    domainAllowList: config.domainAllowList,
    enforceSso: config.enforceSso
  };
}

export async function upsertAuthConfig(data: Partial<AuthConfigDefaults>) {
  const payload = {
    ssoEnabled: data.ssoEnabled ?? defaults.ssoEnabled,
    issuerUrl: data.issuerUrl ?? null,
    clientId: data.clientId ?? null,
    scopes: data.scopes ?? defaults.scopes,
    allowPasswordLogin: data.allowPasswordLogin ?? defaults.allowPasswordLogin,
    domainAllowList: data.domainAllowList ?? defaults.domainAllowList,
    enforceSso: data.enforceSso ?? defaults.enforceSso
  };

  return prisma.authConfig.upsert({
    where: { key: "default" },
    update: payload,
    create: { key: "default", ...payload }
  });
}
