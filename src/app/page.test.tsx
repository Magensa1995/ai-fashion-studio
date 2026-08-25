import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock("@/server/auth/runtime", () => ({
  auth: authMock,
}));

describe("HomePage", () => {
  beforeEach(() => {
    cleanup();
    authMock.mockReset();
  });

  async function renderHomePage(session: { user?: { id?: string } } | null) {
    authMock.mockResolvedValue(session);
    render(await HomePage());
  }

  it("introduces the studio and its foundation status", async () => {
    await renderHomePage(null);

    expect(
      screen.getByRole("heading", { name: "AI Fashion Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation in progress")).toBeInTheDocument();
  });

  it("shows a sign-in action instead of sign-out for anonymous visitors", async () => {
    await renderHomePage(null);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.queryByRole("button", { name: "Sign out" }),
    ).not.toBeInTheDocument();
  });

  it("shows the sign-out action only for authenticated owners", async () => {
    await renderHomePage({ user: { id: "owner-1" } });

    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });
});
