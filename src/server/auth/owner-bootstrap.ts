import "server-only";

import { normalizeEmail } from "@/server/auth/email";
import { hashPassword } from "@/server/auth/password";

type Owner = {
  email: string;
  passwordHash: string;
};

export type OwnerStore = {
  findUnique(args: { where: { email: string } }): Promise<Owner | null>;
  findFirst(): Promise<Owner | null>;
  create(args: { data: Owner }): Promise<Owner>;
};

type BootstrapOwnerOptions = {
  email: string;
  password: string;
  owners: OwnerStore;
};

export async function bootstrapOwner({
  email,
  password,
  owners,
}: BootstrapOwnerOptions) {
  const normalizedEmail = normalizeEmail(email);
  const existingOwner = await owners.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingOwner) {
    return { created: false };
  }

  const anyOwner = await owners.findFirst();

  if (anyOwner) {
    return { created: false };
  }

  const passwordHash = await hashPassword(password);

  try {
    await owners.create({
      data: { email: normalizedEmail, passwordHash },
    });

    return { created: true };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const owner = await owners.findFirst();

      if (owner) {
        return { created: false };
      }
    }

    throw error;
  }
}
