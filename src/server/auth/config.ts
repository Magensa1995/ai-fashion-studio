import "server-only";

import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getServerEnv } from "@/config/env";
import { normalizeEmail } from "@/server/auth/email";
import { verifyPassword } from "@/server/auth/password";
import { getDatabaseClient } from "@/server/db/client";

type Owner = {
  id: string;
  passwordHash: string;
};

type AuthEnvironment = Pick<
  ReturnType<typeof getServerEnv>,
  "AUTH_SECRET" | "AUTH_TRUST_HOST" | "NODE_ENV"
>;

type AuthConfigOptions = {
  environment?: AuthEnvironment;
  findOwnerByEmail?: (email: string) => Promise<Owner | null>;
  verifyOwnerPassword?: (
    password: string,
    passwordHash: string,
  ) => Promise<boolean>;
};

async function findOwnerByEmail(email: string): Promise<Owner | null> {
  return getDatabaseClient().user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
}

export function createAuthConfig({
  environment = getServerEnv(),
  findOwnerByEmail: findOwner = findOwnerByEmail,
  verifyOwnerPassword = verifyPassword,
}: AuthConfigOptions = {}): NextAuthConfig {
  return {
    secret: environment.AUTH_SECRET,
    trustHost: environment.AUTH_TRUST_HOST,
    session: { strategy: "jwt" },
    cookies:
      environment.NODE_ENV === "production"
        ? {
            sessionToken: {
              name: "__Secure-authjs.session-token",
              options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: true,
              },
            },
          }
        : undefined,
    callbacks: {
      session({ session, token }) {
        if (typeof token.sub !== "string") {
          return { expires: session.expires };
        }

        return { expires: session.expires, user: { id: token.sub } };
      },
    },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email;
          const password = credentials?.password;

          if (typeof email !== "string" || typeof password !== "string") {
            return null;
          }

          const owner = await findOwner(normalizeEmail(email));
          const passwordMatches = await verifyOwnerPassword(
            password,
            owner?.passwordHash ?? "not-a-password-hash",
          );

          return owner && passwordMatches ? { id: owner.id } : null;
        },
      }),
    ],
  };
}
