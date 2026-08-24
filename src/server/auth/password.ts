import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const algorithm = "scrypt";
const version = "v1";
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;
const saltLength = 16;
const derivedKeyLength = 64;
const maxMemory = 32 * 1024 * 1024;
const base64Url = /^[A-Za-z0-9_-]+$/;
const fallbackPasswordHash: ParsedPasswordHash = {
  salt: Buffer.from("fallback-salt-v1", "utf8"),
  derivedKey: Buffer.alloc(derivedKeyLength),
};

type ParsedPasswordHash = {
  salt: Buffer;
  derivedKey: Buffer;
};

function encodePasswordHash(salt: Buffer, derivedKey: Buffer) {
  return [
    algorithm,
    version,
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

function parsePasswordHash(passwordHash: string): ParsedPasswordHash | null {
  const [
    hashAlgorithm,
    hashVersion,
    hashCost,
    hashBlockSize,
    hashParallelization,
    encodedSalt,
    encodedDerivedKey,
    ...rest
  ] = passwordHash.split("$");

  if (
    rest.length > 0 ||
    hashAlgorithm !== algorithm ||
    hashVersion !== version ||
    hashCost !== String(cost) ||
    hashBlockSize !== String(blockSize) ||
    hashParallelization !== String(parallelization) ||
    !encodedSalt ||
    !encodedDerivedKey ||
    !base64Url.test(encodedSalt) ||
    !base64Url.test(encodedDerivedKey)
  ) {
    return null;
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const derivedKey = Buffer.from(encodedDerivedKey, "base64url");

  if (salt.length !== saltLength || derivedKey.length !== derivedKeyLength) {
    return null;
  }

  return { salt, derivedKey };
}

async function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      derivedKeyLength,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: maxMemory,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(saltLength);
  const derivedKey = await deriveKey(password, salt);

  return encodePasswordHash(salt, derivedKey);
}

export async function verifyPassword(password: string, passwordHash: string) {
  try {
    const parsedPasswordHash = parsePasswordHash(passwordHash);
    const storedPasswordHash = parsedPasswordHash ?? fallbackPasswordHash;
    const derivedKey = await deriveKey(password, storedPasswordHash.salt);
    const matches = timingSafeEqual(derivedKey, storedPasswordHash.derivedKey);

    return parsedPasswordHash !== null && matches;
  } catch {
    return false;
  }
}
