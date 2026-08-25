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

    render(await LoginPage());

    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use the owner credentials configured for AI Fashion Studio.",
      ),
    ).toBeInTheDocument();
  });

  it("redirects authenticated owners away from the login page", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    redirectMock.mockImplementation(() => {
      throw redirectError;
    });
    authMock.mockResolvedValue({ user: { id: "owner-1" } });

    await expect(LoginPage()).rejects.toBe(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
