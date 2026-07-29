import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Hash plaintext password (bcrypt; Argon2-ready interface). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function hashPasswordSync(plain: string): string {
  return bcrypt.hashSync(plain, ROUNDS);
}

export async function verifyPassword(
  plain: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}
