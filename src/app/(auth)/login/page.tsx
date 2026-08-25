import { redirect } from "next/navigation";

import { login } from "@/app/(auth)/login/actions";
import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/server/auth/runtime";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <section className="border-border bg-card w-full rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
          Private creative workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          Use the owner credentials configured for AI Fashion Studio.
        </p>
        <div className="mt-8">
          <LoginForm action={login} />
        </div>
      </section>
    </main>
  );
}
