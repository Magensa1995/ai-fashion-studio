import { ArrowRight, Images, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";

import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { auth } from "@/server/auth/runtime";

export default async function HomePage() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:px-8">
      <div className="border-border bg-card text-muted-foreground mb-8 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm">
        <span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />
        Foundation in progress
      </div>

      <div className="max-w-3xl">
        <p className="text-primary mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
          Private creative workspace
        </p>
        <h1 className="text-5xl leading-tight font-semibold tracking-tight text-balance sm:text-7xl">
          AI Fashion Studio
        </h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
          Organize products and models, generate campaign-ready fashion imagery,
          and turn the best results into publishable copy from one focused
          studio.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button disabled>
          Open studio
          <ArrowRight aria-hidden="true" />
        </Button>
        {isAuthenticated ? (
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        ) : (
          <Button asChild variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
        <span className="text-muted-foreground self-center text-sm">
          Workspace access arrives in Phase 1.
        </span>
      </div>

      <section
        className="border-border bg-border mt-20 grid gap-px overflow-hidden rounded-2xl border md:grid-cols-3"
        aria-label="Planned studio capabilities"
      >
        {[
          {
            icon: Shirt,
            title: "Product library",
            copy: "Keep garment references organized.",
          },
          {
            icon: Sparkles,
            title: "AI workflows",
            copy: "Generate, try on, and refine imagery.",
          },
          {
            icon: Images,
            title: "Content library",
            copy: "Favorite outputs and prepare posts.",
          },
        ].map(({ icon: Icon, title, copy }) => (
          <article key={title} className="bg-card p-6">
            <Icon className="text-primary mb-8 size-5" aria-hidden="true" />
            <h2 className="font-medium">{title}</h2>
            <p className="text-muted-foreground mt-2 text-sm">{copy}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
