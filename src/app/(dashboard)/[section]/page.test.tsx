import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { guardMock, notFoundMock } = vi.hoisted(() => ({
  guardMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

vi.mock("@/app/(dashboard)/guard", () => ({
  requireDashboardUser: guardMock,
}));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import PlaceholderPage from "@/app/(dashboard)/[section]/page";

describe("planned feature placeholder", () => {
  beforeEach(() => {
    guardMock.mockReset().mockResolvedValue("owner-1");
    notFoundMock.mockReset().mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("keeps a planned feature route protected and labels it as forthcoming", async () => {
    render(
      await PlaceholderPage({ params: Promise.resolve({ section: "studio" }) }),
    );

    expect(guardMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Studio" })).toBeVisible();
    expect(screen.getByText("Coming soon")).toBeVisible();
  });

  it("rejects unplanned dynamic sections instead of presenting a false feature", async () => {
    await expect(
      PlaceholderPage({ params: Promise.resolve({ section: "billing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(guardMock).toHaveBeenCalledOnce();
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
