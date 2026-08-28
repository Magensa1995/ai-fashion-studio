// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  createLoginAction,
  createLogoutAction,
} from "@/app/(auth)/login/login-service";
import { emptyLoginFormState } from "@/app/(auth)/login/login-state";

const invalidCredentialsMessage = "Unable to sign in with those credentials.";
const serviceUnavailableMessage =
  "Sign-in is temporarily unavailable. Try again.";

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

describe("createLoginAction", () => {
  it("returns safe required-field errors without calling Auth.js", async () => {
    const signIn = vi.fn();
    const login = createLoginAction(signIn);

    await expect(login(emptyLoginFormState, formData({}))).resolves.toEqual({
      fieldErrors: {
        email: "Enter your email address.",
        password: "Enter your password.",
      },
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("returns one normalized safe error for invalid credentials", async () => {
    const signIn = vi.fn().mockRejectedValue(
      Object.assign(new Error("CredentialsSignin"), {
        type: "CredentialsSignin",
        kind: "signIn",
        code: "credentials",
      }),
    );
    const login = createLoginAction(signIn);

    await expect(
      login(
        emptyLoginFormState,
        formData({ email: "owner@example.com", password: "wrong-password" }),
      ),
    ).resolves.toEqual({ error: invalidCredentialsMessage });
  });

  it("returns a distinct safe error for infrastructure auth failures", async () => {
    const signIn = vi.fn().mockRejectedValue(
      Object.assign(new Error("database timed out"), {
        type: "CallbackRouteError",
        kind: "error",
      }),
    );
    const login = createLoginAction(signIn);

    const state = await login(
      emptyLoginFormState,
      formData({ email: "owner@example.com", password: "wrong-password" }),
    );

    expect(state).toEqual({
      error: serviceUnavailableMessage,
    });
    expect(JSON.stringify(state)).not.toContain("owner@example.com");
    expect(JSON.stringify(state)).not.toContain("database timed out");
  });

  it("returns the same safe service error for unexpected non-credential failures", async () => {
    const signIn = vi
      .fn()
      .mockRejectedValue(
        new Error("The database connection pool is exhausted."),
      );
    const login = createLoginAction(signIn);

    await expect(
      login(
        emptyLoginFormState,
        formData({ email: "owner@example.com", password: "wrong-password" }),
      ),
    ).resolves.toEqual({ error: serviceUnavailableMessage });
  });

  it("preserves the redirect that represents a successful sign-in", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/;303;",
    });
    const signIn = vi.fn().mockRejectedValue(redirect);
    const login = createLoginAction(signIn);

    await expect(
      login(
        emptyLoginFormState,
        formData({
          callbackUrl: "/?campaign=draft",
          email: "owner@example.com",
          password: "owner-passphrase-2026",
        }),
      ),
    ).rejects.toBe(redirect);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "owner@example.com",
      password: "owner-passphrase-2026",
      redirectTo: "/?campaign=draft",
    });
  });

  it("passes a safe callback query and hash through to Auth.js", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/;303;",
    });
    const signIn = vi.fn().mockRejectedValue(redirect);
    const login = createLoginAction(signIn);
    const callbackUrl = "/studio?step=2&filter=latest#reference";

    await expect(
      login(
        emptyLoginFormState,
        formData({
          callbackUrl,
          email: "owner@example.com",
          password: "owner-passphrase-2026",
        }),
      ),
    ).rejects.toBe(redirect);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "owner@example.com",
      password: "owner-passphrase-2026",
      redirectTo: callbackUrl,
    });
  });

  it("never passes an unsafe callback destination to Auth.js", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/;303;",
    });
    const signIn = vi.fn().mockRejectedValue(redirect);
    const login = createLoginAction(signIn);

    await expect(
      login(
        emptyLoginFormState,
        formData({
          callbackUrl: "https://attacker.example/steal",
          email: "owner@example.com",
          password: "owner-passphrase-2026",
        }),
      ),
    ).rejects.toBe(redirect);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "owner@example.com",
      password: "owner-passphrase-2026",
      redirectTo: "/",
    });
  });

  it("does not treat redirect-like lookalikes as successful redirects", async () => {
    const redirectLookalike = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/;not-a-status;",
    });
    const signIn = vi.fn().mockRejectedValue(redirectLookalike);
    const login = createLoginAction(signIn);

    await expect(
      login(
        emptyLoginFormState,
        formData({
          email: "owner@example.com",
          password: "owner-passphrase-2026",
        }),
      ),
    ).resolves.toEqual({ error: serviceUnavailableMessage });
  });

  it("signs out through the server and returns to the login page", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const logout = createLogoutAction(signOut);

    await logout();

    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
