// @vitest-environment node

import { spawn } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type CommandResult = {
  exitCode: number | null;
  stderr: string;
  stdout: string;
};

function runBootstrapCommand() {
  const environment = { ...process.env };
  delete environment.DATABASE_URL;
  delete environment.OWNER_EMAIL;
  delete environment.OWNER_PASSWORD;
  delete environment.TEST_DATABASE_URL;
  environment.DOTENV_CONFIG_PATH = join(
    process.cwd(),
    ".bootstrap-owner-test.env",
  );

  return new Promise<CommandResult>((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
    const args = isWindows
      ? ["/d", "/s", "/c", "pnpm bootstrap:owner"]
      : ["bootstrap:owner"];
    const processHandle = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      shell: false,
    });
    let stdout = "";
    let stderr = "";

    processHandle.stdout.setEncoding("utf8");
    processHandle.stderr.setEncoding("utf8");
    processHandle.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    processHandle.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    processHandle.once("error", reject);
    processHandle.once("close", (exitCode) => {
      resolve({ exitCode, stderr, stdout });
    });
  });
}

describe("bootstrap:owner command", () => {
  it("loads server-only modules before reporting a generic bootstrap failure", async () => {
    const result = await runBootstrapCommand();
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.exitCode).toBe(1);
    expect(output).toContain("Owner bootstrap failed.");
    expect(output).not.toContain(
      "This module cannot be imported from a Client Component module.",
    );
  });
});
