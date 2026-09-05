import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { privatePathHeader } from "@/server/auth/callback";
import {
  buildLoginRedirect,
  requireUser,
  UnauthorizedError,
} from "@/server/auth/session";

export async function requireDashboardUser() {
  try {
    return await requireUser();
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      throw error;
    }
  }

  const callbackUrl = (await headers()).get(privatePathHeader);
  redirect(buildLoginRedirect(callbackUrl));
}
