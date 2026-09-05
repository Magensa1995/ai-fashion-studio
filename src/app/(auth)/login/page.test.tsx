import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/server/auth/runtime", () => ({
  auth: authMock,
}));

import LoginPage from "@/app/(auth)/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    cleanup();
    authMock.mockReset();
    redirectMock.mockReset();
  });

  it("renders the login form for anonymous visitors", async () => {
    authMock.mockResolvedValue(null);

    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use the owner credentials configured for AI Fashion Studio.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the login form for an expired session instead of redirecting", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    redirectMock.mockImplementation(() => {
      throw redirectError;
    });
    authMock.mockResolvedValue({
      expires: "2026-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });

    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("passes only a safe same-origin callback to the login form", async () => {
    authMock.mockResolvedValue(null);

    const { container } = render(
      await LoginPage({
        searchParams: Promise.resolve({ callbackUrl: "/?campaign=draft" }),
      }),
    );

    expect(
      container.querySelector<HTMLInputElement>('input[name="callbackUrl"]'),
    ).toHaveValue("/?campaign=draft");
  });

  it("preserves a safe callback path with its full query and hash", async () => {
    authMock.mockResolvedValue(null);

    const callbackUrl = "/studio?step=2&filter=latest#reference";
    const { container } = render(
      await LoginPage({
        searchParams: Promise.resolve({ callbackUrl }),
      }),
    );

    expect(
      container.querySelector<HTMLInputElement>('input[name="callbackUrl"]'),
    ).toHaveValue(callbackUrl);
  });

  it("replaces an unsafe callback with the dashboard root", async () => {
    authMock.mockResolvedValue(null);

    const { container } = render(
      await LoginPage({
        searchParams: Promise.resolve({
          callbackUrl: "https://attacker.example/steal",
        }),
      }),
    );

    expect(
      container.querySelector<HTMLInputElement>('input[name="callbackUrl"]'),
    ).toHaveValue("/");
  });

  it("redirects authenticated owners away from the login page", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    redirectMock.mockImplementation(() => {
      throw redirectError;
    });
    authMock.mockResolvedValue({
      expires: "2099-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });

    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toBe(
      redirectError,
    );
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects an authenticated owner to a safe callback without looping", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    redirectMock.mockImplementation(() => {
      throw redirectError;
    });
    authMock.mockResolvedValue({
      expires: "2099-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });

    await expect(
      LoginPage({
        searchParams: Promise.resolve({
          callbackUrl: "/login?callbackUrl=%2Fstudio",
        }),
      }),
    ).rejects.toBe(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
