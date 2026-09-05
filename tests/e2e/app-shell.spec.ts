import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const captureVisualQa = process.env.CAPTURE_VISUAL_QA === "1";

test.describe("responsive private workspace shell", () => {
  test.skip(!hasTestDatabase, "requires the CI isolated test database");
  test.describe.configure({ mode: "serial" });

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

  async function signIn(page: Page) {
    await page.goto("/login");
    const form = page.getByRole("form", { name: "Sign in form" });
    await form.getByLabel("Email").fill("owner@example.com");
    await form.getByLabel("Password").fill("owner-passphrase-2026");
    await form.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
  }

  for (const width of [390, 1024, 1440]) {
    test(`keeps workspace navigation usable at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(
        1,
      );

      const menuButton = page.getByRole("button", { name: "Open navigation" });
      const desktopNavigation = page
        .locator("aside")
        .filter({ has: page.getByRole("navigation", { name: "Workspace" }) })
        .first();

      if (width < 1024) {
        await expect(menuButton).toBeVisible();
        await expect(desktopNavigation).toBeHidden();
        await menuButton.click();

        const dialog = page.getByRole("dialog", {
          name: "Workspace navigation",
        });
        await expect(dialog).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Close navigation" }),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(menuButton).toBeFocused();

        await menuButton.click();
        await expect(dialog).toBeVisible();
        await page.setViewportSize({ width: 1024, height: 900 });
        await expect(dialog).toBeHidden();
        await expect(menuButton).toBeHidden();
        await expect
          .poll(() => page.evaluate(() => document.body.style.overflow))
          .toBe("");

        const desktopDashboardLink = desktopNavigation.getByRole("link", {
          name: "Dashboard",
        });
        await expect(desktopDashboardLink).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(desktopDashboardLink).toBeFocused();

        await page.setViewportSize({ width, height: 900 });
        await expect(menuButton).toBeVisible();
        await expect(menuButton).toHaveAttribute("aria-expanded", "false");
      } else {
        await expect(menuButton).toBeHidden();
        await expect(desktopNavigation).toBeVisible();
        await expect(
          desktopNavigation.getByRole("link", { name: "Dashboard" }),
        ).toHaveAttribute("aria-current", "page");
      }

      if (captureVisualQa) {
        await page.screenshot({
          path: path.join(testInfo.outputDir, `app-shell-${width}.png`),
          fullPage: true,
        });
      }
    });
  }
});
