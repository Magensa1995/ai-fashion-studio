import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, headersMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/server/auth/runtime", () => ({ auth: authMock }));

import DashboardLayout from "@/app/(dashboard)/layout";

describe("DashboardLayout", () => {
  beforeEach(() => {
    cleanup();
    authMock.mockReset();
    headersMock.mockReset();
    redirectMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
  });

  it("renders the private workspace for an authenticated owner", async () => {
    authMock.mockResolvedValue({
      expires: "2099-08-24T00:00:00.000Z",
      user: { id: "owner-1" },
    });

    render(await DashboardLayout({ children: <p>Private workspace</p> }));

    expect(screen.getByText("Private workspace")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
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
