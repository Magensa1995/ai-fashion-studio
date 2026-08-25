"use client";

import { useActionState, useState } from "react";

import {
  emptyLoginFormState,
  type LoginAction,
} from "@/app/(auth)/login/login-state";
import { Button } from "@/components/ui/button";

type LoginFormProps = {
  action: LoginAction;
};

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    emptyLoginFormState,
  );
  const [email, setEmail] = useState("");

  return (
    <form
      action={formAction}
      aria-label="Sign in form"
      className="grid gap-5"
      noValidate={false}
    >
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-10 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          id="email"
          name="email"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email ? (
          <p className="text-sm text-red-700" id="email-error">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-10 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          id="password"
          name="password"
          required
          type="password"
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        {state.fieldErrors?.password ? (
          <p className="text-sm text-red-700" id="password-error">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
