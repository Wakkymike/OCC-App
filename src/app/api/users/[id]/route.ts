import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket/events';

/** GET /api/users/[id] — Get a single user profile */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Users can read their own profile; admins can read any
  if (authUser.id !== id && !authUser.isAdmin && !isSuperAdmin(authUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT id, email, displayName, isAdmin, isContentCreator, isActive,
           passwordChangeRequired, forceSignOut, icalUrl, createdAt
    FROM users WHERE id = ?
  `).get(id) as any;

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    user: {
      ...user,
      isAdmin: !!user.isAdmin,
      isContentCreator: !!user.isContentCreator,
      isActive: !!user.isActive,
      passwordChangeRequired: !!user.passwordChangeRequired,
      forceSignOut: !!user.forceSignOut,
    }
  });
}

/** PATCH /api/users/[id] — Update a user profile */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Determine what fields the caller is allowed to update
  const isSelf = authUser.id === id;
  const isAdminUser = authUser.isAdmin || isSuperAdmin(authUser);

  if (!isSelf && !isAdminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const allowedFields: Record<string, string> = {
    displayName: 'displayName',
    icalUrl: 'icalUrl',
  };

  // Admin-only fields
  if (isAdminUser) {
    Object.assign(allowedFields, {
      isAdmin: 'isAdmin',
      isContentCreator: 'isContentCreator',
      isActive: 'isActive',
      passwordChangeRequired: 'passwordChangeRequired',
      forceSignOut: 'forceSignOut',
    });
  }

  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, col] of Object.entries(allowedFields)) {
    if (body[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      // Convert booleans to integers for SQLite
      values.push(typeof body[key] === 'boolean' ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  setClauses.push("updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  values.push(id);

  db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

  emitSocketEvent(SOCKET_EVENTS.USER_UPDATED, { userId: id });

  return NextResponse.json({ success: true });
}

/** DELETE /api/users/[id] — Delete a user (admin only) */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!authUser.isAdmin && !isSuperAdmin(authUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent deleting the super-admin account
  const superEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const db = getDb();
  const targetUser = db.prepare('SELECT email FROM users WHERE id = ?').get(id) as any;
  if (targetUser && superEmail && targetUser.email === superEmail) {
    return NextResponse.json({ error: 'The super-admin account cannot be deleted.' }, { status: 403 });
  }

  // Delete related data
  db.prepare('DELETE FROM call_logs WHERE userId = ?').run(id);
  db.prepare('DELETE FROM driver_hours WHERE userId = ?').run(id);

  // Delete linked invitations
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(id) as any;
  if (user) {
    db.prepare('DELETE FROM invitations WHERE email = ?').run(user.email);
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  emitSocketEvent(SOCKET_EVENTS.USER_UPDATED, { userId: id, deleted: true });

  return NextResponse.json({ success: true });
}
