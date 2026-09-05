import { notFound } from "next/navigation";

import { requireDashboardUser } from "@/app/(dashboard)/guard";
import { findNavigationItem } from "@/components/layout/navigation";

type PlaceholderPageProps = {
  params: Promise<{ section: string }>;
};

export default async function PlaceholderPage({
  params,
}: PlaceholderPageProps) {
  await requireDashboardUser();
  const { section } = await params;
  const item = findNavigationItem(section);

  if (!item || item.availability !== "planned") {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-6 py-16 lg:px-8">
      <div className="border-border bg-card max-w-2xl rounded-3xl border p-8 shadow-sm sm:p-12">
        <span className="bg-primary/10 text-primary inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
          Coming soon
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          {item.label}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-base leading-7 sm:text-lg">
          {item.description} will arrive in a later implementation task. This
          route is reserved now so the workspace navigation remains predictable.
        </p>
      </div>
    </main>
  );
}
