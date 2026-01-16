import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import OktaProvider from "next-auth/providers/okta";
import AzureADProvider from "next-auth/providers/azure-ad";
import type { OAuthConfig } from "next-auth/providers";
import { AuditAction, Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthConfig } from "@/lib/auth-config";
import { logAuditEvent } from "@/lib/audit/log";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const oktaConfig =
  process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER
    ? {
        clientId: process.env.OKTA_CLIENT_ID,
        clientSecret: process.env.OKTA_CLIENT_SECRET,
        issuer: process.env.OKTA_ISSUER
      }
    : null;

const azureAdConfig =
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
    ? {
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        tenantId: process.env.AZURE_AD_TENANT_ID
      }
    : null;

const oidcConfig: OAuthConfig<Record<string, unknown>> | null =
  process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.OIDC_ISSUER
    ? {
        id: "oidc",
        name: "SSO",
        type: "oauth",
        wellKnown: `${process.env.OIDC_ISSUER}/.well-known/openid-configuration`,
        authorization: { params: { scope: "openid email profile" } },
        clientId: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        idToken: true,
        checks: ["pkce", "state"],
        profile(profile: { sub?: string; name?: string; preferred_username?: string; email?: string }) {
          return {
            id: profile.sub ?? profile.email ?? "oidc-user",
            name: profile.name ?? profile.preferred_username ?? profile.email ?? "SSO User",
            email: profile.email ?? null
          };
        }
      }
    : null;

const providers = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Senha", type: "password" }
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const user = await prisma.user.findFirst({
        where: { email: parsed.data.email, deletedAt: null }
      });

      if (!user) {
        return null;
      }

      const isValid = bcrypt.compareSync(parsed.data.password, user.passwordHash);
      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        passwordChangedAt: user.passwordChangedAt
      };
    }
  })
];

const ssoPasswordHash = bcrypt.hashSync("sso-login", 10);

if (oktaConfig) {
  providers.push(OktaProvider(oktaConfig));
}

if (azureAdConfig) {
  providers.push(AzureADProvider(azureAdConfig));
}

if (oidcConfig) {
  providers.push(oidcConfig);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      const config = await getAuthConfig();
      const isCredentials = account?.provider ? account.provider === "credentials" : true;
      const email = (user as { email?: string } | undefined)?.email ?? null;
      const role = (user as { role?: Role } | undefined)?.role ?? null;

      if (email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser?.deletedAt) {
          return false;
        }
      }

      if (!isCredentials) {
        if (!config.ssoEnabled) {
          return false;
        }

        if (config.domainAllowList.length > 0 && email) {
          const domain = email.split("@")[1]?.toLowerCase();
          const allowed = config.domainAllowList.some(
            (item) => item.toLowerCase() === domain
          );
          if (!allowed) {
            return false;
          }
        }

        return Boolean(email);
      }

      if (!config.allowPasswordLogin || config.enforceSso) {
        return role === Role.ADMIN;
      }

      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.passwordChangedAt =
          (user as { passwordChangedAt?: Date | null }).passwordChangedAt?.toISOString?.() ?? null;
      }

      if (trigger === "update" && session) {
        const nextMustChange = (session as { mustChangePassword?: boolean }).mustChangePassword;
        if (typeof nextMustChange === "boolean") {
          token.mustChangePassword = nextMustChange;
        }
      }

      if (account && account.provider !== "credentials") {
        const email = token.email ?? (user as { email?: string } | undefined)?.email;
        if (email) {
          const existingUser = await prisma.user.findUnique({ where: { email } });
          if (existingUser?.deletedAt) {
            return token;
          }

          const dbUser = await prisma.user.upsert({
            where: { email },
            update: {
              name: (user as { name?: string } | undefined)?.name ?? email,
              mustChangePassword: false
            },
            create: {
              name: (user as { name?: string } | undefined)?.name ?? email,
              email,
              passwordHash: ssoPasswordHash,
              role: Role.VIEWER,
              mustChangePassword: false
            }
          });
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.mustChangePassword = dbUser.mustChangePassword;
          token.passwordChangedAt = dbUser.passwordChangedAt
            ? dbUser.passwordChangedAt.toISOString()
            : null;
        } else if (!token.role) {
          token.role = Role.VIEWER;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) ?? Role.VIEWER;
        session.user.id = token.sub ?? "";
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    }
  },
  events: {
    async signIn({ user, account }) {
      const email = (user as { email?: string } | undefined)?.email ?? null;
      const dbUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
      await logAuditEvent({
        action: AuditAction.LOGIN,
        entityType: "Auth",
        entityId: dbUser?.id ?? null,
        actor: {
          id: dbUser?.id ?? null,
          email: email ?? null,
          role: dbUser?.role ?? null
        },
        metadata: { provider: account?.provider ?? null },
        requestContext: {}
      });
    },
    async signOut({ token, session }) {
      const email = session?.user?.email ?? (token?.email as string | undefined) ?? null;
      const dbUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
      await logAuditEvent({
        action: AuditAction.LOGOUT,
        entityType: "Auth",
        entityId: dbUser?.id ?? null,
        actor: {
          id: dbUser?.id ?? null,
          email: email ?? null,
          role: dbUser?.role ?? null
        },
        requestContext: {}
      });
    }
  }
};
