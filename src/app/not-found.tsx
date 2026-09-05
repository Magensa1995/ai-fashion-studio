import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      <p className="text-primary text-sm font-semibold tracking-[0.18em] uppercase">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-muted-foreground mt-4 leading-7">
        This page does not exist or is not part of the private studio.
      </p>
      <Link
        href="/"
        className={buttonVariants({ className: "mt-8 self-center" })}
      >
        Back to dashboard
      </Link>
    </main>
  );
}
