import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("introduces the studio and its foundation status", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "AI Fashion Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation in progress")).toBeInTheDocument();
  });
});
