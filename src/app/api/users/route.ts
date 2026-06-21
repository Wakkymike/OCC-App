import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';

/** GET /api/users — List all users (admin only) */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const superEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const users = db.prepare(`
    SELECT id, email, displayName, isAdmin, isContentCreator, isActive,
           passwordChangeRequired, forceSignOut, icalUrl, createdAt
    FROM users ORDER BY createdAt DESC
  `).all().map((u: any) => {
    const isSuper = !!superEmail && u.email === superEmail;
    return {
      ...u,
      isAdmin: !!u.isAdmin || isSuper,
      isSuperAdmin: isSuper,
      isContentCreator: !!u.isContentCreator,
      isActive: !!u.isActive,
      passwordChangeRequired: !!u.passwordChangeRequired,
      forceSignOut: !!u.forceSignOut,
    };
  });

  return NextResponse.json({ users });
}
