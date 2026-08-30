import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/(dashboard)/page";

const { authMock, headersMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/server/auth/runtime", () => ({
  auth: authMock,
}));

describe("HomePage", () => {
  beforeEach(() => {
    cleanup();
    authMock.mockReset();
    headersMock.mockReset();
    redirectMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
  });

  async function renderHomePage(
    session: { expires?: string; user?: { id?: string } } | null,
  ) {
    authMock.mockResolvedValue(session);
    render(await HomePage());
  }

  it("introduces the studio and its foundation status", async () => {
    await renderHomePage({
      expires: "2099-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });

    expect(
      screen.getByRole("heading", { name: "AI Fashion Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation in progress")).toBeInTheDocument();
  });

  it("redirects an anonymous page render to login with the current path", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    authMock.mockResolvedValue(null);
    headersMock.mockResolvedValue(
      new Headers({
        "x-ai-fashion-private-path": "/studio?step=2&filter=latest",
      }),
    );
    redirectMock.mockImplementation(() => {
      throw redirectError;
    });

    await expect(HomePage()).rejects.toBe(redirectError);
    expect(redirectMock).toHaveBeenCalledWith(
      "/login?callbackUrl=%2Fstudio%3Fstep%3D2%26filter%3Dlatest",
    );
  });

  it("redirects an expired session at the protected page boundary", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    authMock.mockResolvedValue({
      expires: "2026-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });
    redirectMock.mockImplementation(() => {
      throw redirectError;
    });

    await expect(HomePage()).rejects.toBe(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/login?callbackUrl=%2F");
  });

  it("propagates dashboard session infrastructure failures", async () => {
    const sessionFailure = new Error("session store unavailable");

    authMock.mockRejectedValue(sessionFailure);

    await expect(HomePage()).rejects.toBe(sessionFailure);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
