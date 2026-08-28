import "server-only";

const callbackOrigin = "https://ai-fashion-studio.invalid";

export const privatePathHeader = "x-ai-fashion-private-path";

export function safeCallbackPath(callbackUrl: unknown) {
  if (typeof callbackUrl !== "string" || !callbackUrl.startsWith("/")) {
    return "/";
  }

  try {
    const destination = new URL(callbackUrl, callbackOrigin);

    if (
      destination.origin !== callbackOrigin ||
      destination.pathname === "/login" ||
      destination.pathname.startsWith("/login/")
    ) {
      return "/";
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

export function buildLoginRedirect(callbackUrl: unknown) {
  return `/login?callbackUrl=${encodeURIComponent(safeCallbackPath(callbackUrl))}`;
}
