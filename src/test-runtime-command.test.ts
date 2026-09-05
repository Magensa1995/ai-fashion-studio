// @vitest-environment node

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts: Record<string, string>;
};

async function getScripts() {
  const packageJson = await readFile(
    join(process.cwd(), "package.json"),
    "utf8",
  );
  return (JSON.parse(packageJson) as PackageManifest).scripts;
}

async function getCiWorkflow() {
  return readFile(
    join(process.cwd(), ".github", "workflows", "ci.yml"),
    "utf8",
  );
}

async function getRuntimeIntegrationTest() {
  return readFile(
    join(process.cwd(), "src", "server", "auth", "runtime.integration.test.ts"),
    "utf8",
  );
}

describe("production runtime test command", () => {
  it("builds before launching the production route suite", async () => {
    const scripts = await getScripts();

    expect(scripts["test:runtime"]).toBe(
      "pnpm build && pnpm exec vitest run src/server/auth/runtime.integration.test.ts",
    );
  });

  it("keeps the pre-build test command independent of generated artifacts", async () => {
    const scripts = await getScripts();

    expect(scripts["test:base"]).toBe(
      "vitest --exclude src/server/auth/runtime.integration.test.ts",
    );
    expect(scripts.test).toBe("pnpm test:base run");
  });

  it("keeps watch mode independent of generated artifacts", async () => {
    const scripts = await getScripts();

    expect(scripts["test:watch"]).toBe("pnpm test:base");
  });

  it("gives the runtime startup hook more time than its diagnostic deadline", async () => {
    const runtimeIntegrationTest = await getRuntimeIntegrationTest();

    expect(runtimeIntegrationTest).toMatch(
      /await waitForServer\(`\$\{baseUrl\}\/api\/auth\/providers`\);\s*}, 30_000\);/,
    );
  });

  it("runs the built production route suite after the ordinary test command in CI", async () => {
    const workflow = await getCiWorkflow();
    const unitTests = workflow.indexOf("run: pnpm test");
    const runtimeTests = workflow.indexOf("run: pnpm test:runtime");

    expect(unitTests).toBeGreaterThanOrEqual(0);
    expect(runtimeTests).toBeGreaterThan(unitTests);
  });

  it("provides non-production Auth.js runtime configuration in CI", async () => {
    const workflow = await getCiWorkflow();

    expect(workflow).toContain(
      'AUTH_SECRET: "test-auth-secret-with-at-least-32-characters"',
    );
    expect(workflow).toContain('AUTH_TRUST_HOST: "true"');
  });
});
