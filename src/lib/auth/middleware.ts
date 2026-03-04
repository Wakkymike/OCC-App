import { cookies } from 'next/headers';
import { verifyToken, type JwtPayload } from './jwt';
import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'occ_session';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isContentCreator: boolean;
  isActive: boolean;
  passwordChangeRequired: boolean;
  forceSignOut: boolean;
  icalUrl: string | null;
}

/**
 * Get the authenticated user from the request cookies.
 * Returns null if not authenticated or token is invalid.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const db = getDb();
  const user = db.prepare(`
    SELECT id, email, displayName, isAdmin, isContentCreator, isActive,
           passwordChangeRequired, forceSignOut, icalUrl
    FROM users WHERE id = ?
  `).get(payload.userId) as any;

  if (!user) return null;

  const superEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const isSuper = !!superEmail && user.email === superEmail;

  // Auto-activate super admin in DB if not already
  if (isSuper && (!user.isActive || !user.isAdmin)) {
    db.prepare('UPDATE users SET isActive = 1, isAdmin = 1 WHERE id = ?').run(user.id);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: !!user.isAdmin || isSuper,
    isSuperAdmin: isSuper,
    isContentCreator: !!user.isContentCreator,
    isActive: !!user.isActive || isSuper,
    passwordChangeRequired: !!user.passwordChangeRequired,
    forceSignOut: !!user.forceSignOut,
    icalUrl: user.icalUrl,
  };
}

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

/**
 * Require admin access. Returns the user or a 403 response.
 */
export async function requireAdmin(): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

/**
 * Check if a user is the super admin (from SUPER_ADMIN_EMAIL env var).
 */
export function isSuperAdmin(user: AuthUser): boolean {
  return user.isSuperAdmin;
}
