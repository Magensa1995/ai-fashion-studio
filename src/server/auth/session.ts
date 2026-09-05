import "server-only";

import { cache } from "react";

type SessionReader = () => Promise<{
  expires?: string;
  user?: {
    id?: string;
  };
} | null>;

export { buildLoginRedirect, safeCallbackPath } from "@/server/auth/callback";

const readSession = cache(async () => {
  const { auth } = await import("@/server/auth/runtime");

  return auth();
});

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";
  readonly status = 401;

  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(
  sessionReader: SessionReader = readSession,
  now = new Date(),
) {
  const session = await sessionReader();
  const userId = session?.user?.id;
  const expiresAt = session?.expires
    ? new Date(session.expires).getTime()
    : Number.NaN;

  if (
    typeof userId !== "string" ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime()
  ) {
    throw new UnauthorizedError();
  }

  return userId;
}
