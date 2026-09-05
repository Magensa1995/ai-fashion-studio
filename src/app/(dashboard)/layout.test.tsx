import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, headersMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  usePathname: () => "/",
}));
vi.mock("@/server/auth/runtime", () => ({ auth: authMock }));

import DashboardLayout from "@/app/(dashboard)/layout";
import HomePage from "@/app/(dashboard)/page";

describe("DashboardLayout", () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      ),
    );
    authMock.mockReset();
    headersMock.mockReset();
    redirectMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the private workspace for an authenticated owner", async () => {
    authMock.mockResolvedValue({
      expires: "2099-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });

    render(await DashboardLayout({ children: <p>Private workspace</p> }));

    expect(screen.getByText("Private workspace")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Workspace" }),
    ).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("composes the dashboard page with exactly one shell sign-out action", async () => {
    authMock.mockResolvedValue({
      expires: "2099-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });

    render(await DashboardLayout({ children: await HomePage() }));

    expect(screen.getAllByRole("button", { name: /Sign out/ })).toHaveLength(1);
  });

  it("redirects an anonymous deep link to login with its safe callback", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    authMock.mockResolvedValue(null);
    headersMock.mockResolvedValue(
      new Headers({ "x-ai-fashion-private-path": "/?campaign=draft" }),
    );
    redirectMock.mockImplementation(() => {
      throw redirectError;
    });

    await expect(
      DashboardLayout({ children: <p>Private workspace</p> }),
    ).rejects.toBe(redirectError);
    expect(redirectMock).toHaveBeenCalledWith(
      "/login?callbackUrl=%2F%3Fcampaign%3Ddraft",
    );
  });

  it("does not turn an unexpected session failure into a login redirect", async () => {
    const sessionFailure = new Error("session store unavailable");
    authMock.mockRejectedValue(sessionFailure);

    await expect(
      DashboardLayout({ children: <p>Private workspace</p> }),
    ).rejects.toBe(sessionFailure);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
