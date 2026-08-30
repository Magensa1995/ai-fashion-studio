import { describe, expect, it } from "vitest";

import {
  findNavigationItem,
  isNavigationItemActive,
  navigationItems,
} from "@/components/layout/navigation";

describe("workspace navigation model", () => {
  it("marks only the dashboard link active at the workspace root", () => {
    const activeItems = navigationItems.filter((item) =>
      isNavigationItemActive(item.href, "/"),
    );

    expect(activeItems.map((item) => item.label)).toEqual(["Dashboard"]);
  });

  it("keeps a feature section active for nested paths without activating siblings", () => {
    const activeItems = navigationItems.filter((item) =>
      isNavigationItemActive(item.href, "/products/summer-dress"),
    );

    expect(activeItems.map((item) => item.label)).toEqual(["Products"]);
  });

  it("maps every planned feature segment to a deliberate placeholder", () => {
    expect(
      [
        "studio",
        "products",
        "models",
        "generations",
        "media",
        "presets",
        "posts",
      ].map((segment) => findNavigationItem(segment)?.label),
    ).toEqual([
      "Studio",
      "Products",
      "Models",
      "Generations",
      "Media",
      "Presets",
      "Posts",
    ]);
  });
});
