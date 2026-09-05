import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppError from "@/app/error";
import NotFound from "@/app/not-found";
import DashboardLoading from "@/app/(dashboard)/loading";

describe("route boundaries", () => {
  it("offers a retry action without exposing server error details", () => {
    const retry = vi.fn();

    render(
      <AppError error={new Error("database password leaked")} retry={retry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("database password leaked"),
    ).not.toBeInTheDocument();
  });

  it("returns an unknown route to the protected dashboard", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to dashboard" }),
    ).toHaveAttribute("href", "/");
  });

  it("announces dashboard navigation progress", () => {
    render(<DashboardLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace");
  });
});
