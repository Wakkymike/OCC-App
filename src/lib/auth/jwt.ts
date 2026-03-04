import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  email: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return secret;
}

/**
 * Sign a JWT token with user claims.
 * Expires in 7 days by default.
 */
export function signToken(payload: JwtPayload, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, getSecret(), { expiresIn: expiresIn as any });
}

/**
 * Verify and decode a JWT token.
 * Returns the payload if valid, null otherwise.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
