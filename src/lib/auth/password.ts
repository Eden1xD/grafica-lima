import { hash, verify } from "@node-rs/argon2";

// Parâmetros OWASP para Argon2id
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}