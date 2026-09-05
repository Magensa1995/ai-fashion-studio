"use server";

import {
  createLoginAction,
  createLogoutAction,
} from "@/app/(auth)/login/login-service";
import type { LoginFormState } from "@/app/(auth)/login/login-state";

export async function login(previousState: LoginFormState, formData: FormData) {
  const { signIn } = await import("@/server/auth/runtime");

  return createLoginAction(signIn)(previousState, formData);
}

export async function logout() {
  const { signOut } = await import("@/server/auth/runtime");

  return createLogoutAction(signOut)();
}
