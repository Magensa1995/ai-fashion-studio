import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { privatePathHeader } from "@/server/auth/callback";

export { privatePathHeader };

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    privatePathHeader,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
