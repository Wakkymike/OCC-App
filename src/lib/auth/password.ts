import argon2 from 'argon2';

/**
 * The pepper is an application-wide secret that's combined with the password
 * before hashing. Unlike salt (which is per-user and stored in the hash),
 * the pepper is stored ONLY in environment variables and never in the database.
 * 
 * This means even if the database is fully compromised, passwords cannot be
 * cracked without also compromising the server environment.
 */
function getPepper(): string {
  const pepper = process.env.AUTH_PEPPER;
  if (!pepper) {
    throw new Error('AUTH_PEPPER environment variable is not set. Cannot hash passwords safely.');
  }
  return pepper;
}

/**
 * Hash a password using Argon2id with salt (auto-generated) and pepper (env var).
 * 
 * Argon2id is the hybrid variant that provides resistance against both
 * side-channel attacks (Argon2i) and GPU cracking attacks (Argon2d).
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const pepper = getPepper();
  const pepperedPassword = plaintext + pepper;

  return argon2.hash(pepperedPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,   // 64 MB
    timeCost: 3,          // 3 iterations
    parallelism: 4,       // 4 threads
    // Salt is automatically generated and embedded in the hash output
  });
}

/**
 * Verify a password against a stored Argon2id hash.
 * The pepper is re-applied before verification.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  const pepper = getPepper();
  const pepperedPassword = plaintext + pepper;

  try {
    return await argon2.verify(hash, pepperedPassword);
  } catch {
    return false;
  }
}
