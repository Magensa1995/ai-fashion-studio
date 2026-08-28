// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { privatePathHeader, proxy } from "@/proxy";

describe("dashboard path proxy", () => {
  it("passes the requested path and query upstream for the server layout", () => {
    const response = proxy(
      new NextRequest("https://studio.example/?campaign=draft"),
    );

    expect(
      response.headers.get(`x-middleware-request-${privatePathHeader}`),
    ).toBe("/?campaign=draft");
  });

  it("overwrites an untrusted client-supplied path header", () => {
    const response = proxy(
      new NextRequest("https://studio.example/studio?step=2", {
        headers: {
          [privatePathHeader]: "https://attacker.example/steal",
        },
      }),
    );

    expect(
      response.headers.get(`x-middleware-request-${privatePathHeader}`),
    ).toBe("/studio?step=2");
  });
});
