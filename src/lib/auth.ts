import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import OktaProvider from "next-auth/providers/okta";
import AzureADProvider from "next-auth/providers/azure-ad";
import OAuthProvider from "next-auth/providers/oauth";
import { Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

const oidcConfig =
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

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email }
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
        role: user.role
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
  providers.push(OAuthProvider(oidcConfig));
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
    signIn({ user, account }) {
      if (account && account.provider !== "credentials") {
        return Boolean(user?.email);
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }

      if (account && account.provider !== "credentials") {
        const email = token.email ?? (user as { email?: string } | undefined)?.email;
        if (email) {
          const dbUser = await prisma.user.upsert({
            where: { email },
            update: {
              name: (user as { name?: string } | undefined)?.name ?? email
            },
            create: {
              name: (user as { name?: string } | undefined)?.name ?? email,
              email,
              passwordHash: ssoPasswordHash,
              role: Role.VIEWER
            }
          });
          token.sub = dbUser.id;
          token.role = dbUser.role;
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
      }
      return session;
    }
  }
};
