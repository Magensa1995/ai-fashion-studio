import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

test.describe("owner authentication", () => {
  test.skip(!hasTestDatabase, "requires the CI isolated test database");

  test.beforeAll(() => {
    execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/bootstrap-owner.ts",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          OWNER_EMAIL: "owner@example.com",
          OWNER_PASSWORD: "owner-passphrase-2026",
        },
        stdio: "inherit",
      },
    );
  });

  test("keeps a failed sign-in on the login form with a safe error", async ({
    page,
  }) => {
    await page.goto("/login");
    const loginForm = page.getByRole("form", { name: "Sign in form" });
    await loginForm.getByLabel("Email").fill("owner@example.com");
    await loginForm.getByLabel("Password").fill("wrong-passphrase");
    await loginForm.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(loginForm.getByRole("alert")).toHaveText(
      "Unable to sign in with those credentials.",
    );
    await expect(loginForm.getByLabel("Email")).toHaveValue(
      "owner@example.com",
    );
    await expect(loginForm.getByLabel("Password")).toHaveValue("");
  });

  test("signs the owner in and redirects an authenticated session away from login", async ({
    page,
  }) => {
    await page.goto("/login");
    const loginForm = page.getByRole("form", { name: "Sign in form" });
    await loginForm.getByLabel("Email").fill("owner@example.com");
    await loginForm.getByLabel("Password").fill("owner-passphrase-2026");
    await loginForm.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
  });

  test("signs the owner out through the visible server action", async ({
    page,
  }) => {
    await page.goto("/login");
    const loginForm = page.getByRole("form", { name: "Sign in form" });
    await loginForm.getByLabel("Email").fill("owner@example.com");
    await loginForm.getByLabel("Password").fill("owner-passphrase-2026");
    await loginForm.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);

    const signOutButton = page.getByRole("button", { name: "Sign out" });
    await expect(signOutButton).toHaveCount(1);
    await signOutButton.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
