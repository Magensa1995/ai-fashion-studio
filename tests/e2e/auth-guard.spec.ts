import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

test.describe("private workspace auth guard", () => {
  test("redirects an anonymous dashboard deep link to login without looping", async ({
    page,
  }) => {
    await page.goto("/?campaign=draft");

    await expect(page).toHaveURL(
      /\/login\?callbackUrl=%2F%3Fcampaign%3Ddraft$/,
    );
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("normalizes an unsafe callback before it reaches the login form", async ({
    page,
  }) => {
    await page.goto(
      "/login?callbackUrl=https%3A%2F%2Fattacker.example%2Fsteal",
    );

    await expect(page.locator('input[name="callbackUrl"]')).toHaveValue("/");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test.describe("with the owner database", () => {
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

    async function signIn(page: import("@playwright/test").Page) {
      const form = page.getByRole("form", { name: "Sign in form" });
      await form.getByLabel("Email").fill("owner@example.com");
      await form.getByLabel("Password").fill("owner-passphrase-2026");
      await form.getByRole("button", { name: "Sign in" }).click();
    }

    test("returns an authenticated owner to the requested dashboard deep link", async ({
      page,
    }) => {
      await page.goto("/?campaign=draft");
      await signIn(page);

      await expect(page).toHaveURL(
        (url) => url.pathname === "/" && url.search === "?campaign=draft",
      );
      await expect(
        page.getByRole("heading", { name: "AI Fashion Studio" }),
      ).toBeVisible();
    });

    test("does not redirect an authenticated owner off origin", async ({
      page,
    }) => {
      await page.goto(
        "/login?callbackUrl=https%3A%2F%2Fattacker.example%2Fsteal",
      );
      await signIn(page);

      await expect(page).toHaveURL(/\/$/);
      expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3000");
    });
  });
});
