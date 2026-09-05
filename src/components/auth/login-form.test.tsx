import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  emptyLoginFormState,
  type LoginAction,
  type LoginFormState,
} from "@/app/(auth)/login/login-state";
import { LoginForm } from "@/components/auth/login-form";

function renderLoginForm(action: LoginAction, callbackUrl = "/") {
  render(<LoginForm action={action} callbackUrl={callbackUrl} />);
  const form = screen.getByRole("form", { name: "Sign in form" });

  return {
    form,
    email: within(form).getByLabelText("Email"),
    password: within(form).getByLabelText("Password"),
    submit: within(form).getByRole("button", { name: "Sign in" }),
  };
}

afterEach(cleanup);

describe("LoginForm", () => {
  it("exposes a stable accessible name for the sign-in form", () => {
    const action = vi.fn<LoginAction>();
    const { form } = renderLoginForm(action);

    expect(form).toBeVisible();
  });

  it("requires an email and password before the browser submits credentials", () => {
    const action = vi.fn<LoginAction>();
    const { email, password } = renderLoginForm(action);

    expect(email).toBeRequired();
    expect(password).toBeRequired();
    expect((email as HTMLInputElement).checkValidity()).toBe(false);
    expect((password as HTMLInputElement).checkValidity()).toBe(false);
  });

  it("submits the server-normalized callback as hidden form data", () => {
    const action = vi.fn<LoginAction>();
    const { form } = renderLoginForm(action, "/?campaign=draft");

    expect(
      form.querySelector<HTMLInputElement>('input[name="callbackUrl"]'),
    ).toHaveValue("/?campaign=draft");
  });

  it("announces the server's generic invalid-credentials message", async () => {
    const invalidState: LoginFormState = {
      error: "Unable to sign in with those credentials.",
    };
    const action = vi.fn<LoginAction>().mockResolvedValue(invalidState);
    const { form, email, password, submit } = renderLoginForm(action);

    fireEvent.change(email, { target: { value: "owner@example.com" } });
    fireEvent.change(password, { target: { value: "wrong-passphrase" } });
    fireEvent.click(submit);

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Unable to sign in with those credentials.",
    );
  });

  it("preserves the email address and clears the password after a failed submit", async () => {
    const invalidState: LoginFormState = {
      error: "Unable to sign in with those credentials.",
    };
    const action = vi.fn<LoginAction>().mockResolvedValue(invalidState);
    const { form, email, password, submit } = renderLoginForm(action);

    fireEvent.change(email, { target: { value: "owner@example.com" } });
    fireEvent.change(password, { target: { value: "wrong-passphrase" } });
    fireEvent.click(submit);

    await within(form).findByRole("alert");
    await waitFor(() => expect(password).toHaveValue(""));
    expect(email).toHaveValue("owner@example.com");
  });

  it("disables the submit control while the request is pending", async () => {
    let finishLogin: (state: LoginFormState) => void = () => undefined;
    const action = vi.fn<LoginAction>(
      () =>
        new Promise<LoginFormState>((resolve) => {
          finishLogin = resolve;
        }),
    );
    const { email, password, submit } = renderLoginForm(action);

    fireEvent.change(email, { target: { value: "owner@example.com" } });
    fireEvent.change(password, { target: { value: "owner-passphrase-2026" } });
    fireEvent.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(submit).toHaveTextContent("Signing in…");

    finishLogin(emptyLoginFormState);
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("does not dispatch a second login while the first is pending", async () => {
    const action = vi.fn<LoginAction>(
      () => new Promise<LoginFormState>(() => undefined),
    );
    const { email, password, submit } = renderLoginForm(action);

    fireEvent.change(email, { target: { value: "owner@example.com" } });
    fireEvent.change(password, { target: { value: "owner-passphrase-2026" } });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
