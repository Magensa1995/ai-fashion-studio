import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);
const optionalBoolean = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
);

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: optionalUrl,
  AUTH_SECRET: optionalString,
  AUTH_TRUST_HOST: optionalBoolean,
  OWNER_EMAIL: optionalString,
  OWNER_PASSWORD: optionalString,
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  R2_PUBLIC_BASE_URL: optionalUrl,
  OPENAI_API_KEY: optionalString,
  OPENAI_IMAGE_MODEL: optionalString,
  OPENAI_TEXT_MODEL: optionalString,
});

const ownerBootstrapEnvSchema = z.object({
  OWNER_EMAIL: z.string().trim().email(),
  OWNER_PASSWORD: z.string().min(1),
});

const forbiddenPublicSecrets = [
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_AUTH_SECRET",
  "NEXT_PUBLIC_OWNER_PASSWORD",
  "NEXT_PUBLIC_R2_ACCESS_KEY_ID",
  "NEXT_PUBLIC_R2_SECRET_ACCESS_KEY",
  "NEXT_PUBLIC_OPENAI_API_KEY",
] as const;

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const exposedSecrets = forbiddenPublicSecrets.filter((name) =>
    Boolean(source[name]),
  );

  if (exposedSecrets.length > 0) {
    throw new Error(
      `Server secrets must not use NEXT_PUBLIC_: ${exposedSecrets.join(", ")}`,
    );
  }

  return serverEnvSchema.parse(source);
}

export function parseOwnerBootstrapEnv(
  source: Record<string, string | undefined>,
) {
  return ownerBootstrapEnvSchema.parse(source);
}

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
