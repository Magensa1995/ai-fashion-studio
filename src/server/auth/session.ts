import "server-only";

type SessionReader = () => Promise<{
  user?: {
    id?: string;
  };
} | null>;

async function readSession() {
  const { auth } = await import("@/server/auth/runtime");

  return auth();
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";
  readonly status = 401;

  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(sessionReader: SessionReader = readSession) {
  const session = await sessionReader();
  const userId = session?.user?.id;

  if (typeof userId !== "string") {
    throw new UnauthorizedError();
  }

  return userId;
}
