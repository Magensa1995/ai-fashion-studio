export type LoginFormState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
};

export type LoginAction = (
  previousState: LoginFormState,
  formData: FormData,
) => Promise<LoginFormState>;

export const emptyLoginFormState: LoginFormState = {};
