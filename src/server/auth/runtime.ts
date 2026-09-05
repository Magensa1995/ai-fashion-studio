import "server-only";

import NextAuth from "next-auth";

import { createAuthConfig } from "@/server/auth/config";

export const { auth, handlers, signIn, signOut } = NextAuth(createAuthConfig());
