import { expect, test } from "@playwright/test";

test("redirects the anonymous dashboard route to sign in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\?callbackUrl=%2F$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("serves the deployment health check", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
