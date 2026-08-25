import "server-only";

import type { LoginAction } from "@/app/(auth)/login/login-state";

type SignIn = (
  provider: "credentials",
  options: Record<string, string>,
) => Promise<never>;
type SignOut = (options: { redirectTo: "/login" }) => Promise<never>;

const invalidCredentialsMessage = "Unable to sign in with those credentials.";
const serviceUnavailableMessage =
  "Sign-in is temporarily unavailable. Try again.";
const redirectStatusCodes = new Set(["303", "307", "308"]);

function isRedirectError(error: unknown): error is Error & { digest: string } {
  if (
    typeof error !== "object" ||
    error === null ||
    !("digest" in error) ||
    typeof error.digest !== "string"
  ) {
    return false;
  }

  const digest = error.digest.split(";");
  const [errorCode, redirectType] = digest;
  const destination = digest.slice(2, -2).join(";");
  const statusCode = digest.at(-2);

  return (
    errorCode === "NEXT_REDIRECT" &&
    (redirectType === "replace" || redirectType === "push") &&
    typeof destination === "string" &&
    typeof statusCode === "string" &&
    redirectStatusCodes.has(statusCode)
  );
}

function isCredentialsSigninError(error: unknown): error is Error & {
  type: "CredentialsSignin";
} {
  return (
    error instanceof Error &&
    "type" in error &&
    error.type === "CredentialsSignin"
  );
}

function requiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

export function createLoginAction(signIn: SignIn): LoginAction {
  return async (_previousState, formData) => {
    const email = requiredString(formData, "email");
    const password = requiredString(formData, "password");
    const fieldErrors: { email?: string; password?: string } = {};

    if (!email) {
      fieldErrors.email = "Enter your email address.";
    }

    if (!password) {
      fieldErrors.password = "Enter your password.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors };
    }

    try {
      await signIn("credentials", { email, password, redirectTo: "/" });
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      return {
        error: isCredentialsSigninError(error)
          ? invalidCredentialsMessage
          : serviceUnavailableMessage,
      };
    }

    return { error: invalidCredentialsMessage };
  };
}

export function createLogoutAction(signOut: SignOut) {
  return async () => signOut({ redirectTo: "/login" });
}
