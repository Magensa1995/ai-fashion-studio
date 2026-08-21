import { expect, test } from "@playwright/test";

test("renders the foundation landing route", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AI Fashion Studio" }),
  ).toBeVisible();
  await expect(page.getByText("Foundation in progress")).toBeVisible();
});

test("serves the deployment health check", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
