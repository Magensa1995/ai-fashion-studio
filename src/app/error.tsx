"use client";

import { Button } from "@/components/ui/button";

type AppErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function AppError({ error, retry }: AppErrorProps) {
  void error;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      <p className="text-primary text-sm font-semibold tracking-[0.18em] uppercase">
        Workspace interrupted
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground mt-4 leading-7">
        The workspace could not finish loading. Your saved work has not been
        changed.
      </p>
      <Button className="mt-8 self-center" onClick={retry}>
        Try again
      </Button>
    </main>
  );
}
