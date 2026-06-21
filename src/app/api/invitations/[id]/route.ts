import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';

/** DELETE /api/invitations/[id] */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  db.prepare('DELETE FROM invitations WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}

/** GET /api/invitations/[id] — Get a single invitation (for finish-sign-up) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id);

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  }

  return NextResponse.json({ invitation });
}
