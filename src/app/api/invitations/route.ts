import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';
import { v4 as uuidv4 } from 'uuid';

/** GET /api/invitations — List all invitations (admin only) */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const invitations = db.prepare('SELECT * FROM invitations ORDER BY invitedAt DESC').all();

  return NextResponse.json({ invitations });
}

/** POST /api/invitations — Create an invitation */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const id = uuidv4();

  const db = getDb();
  db.prepare('INSERT INTO invitations (id, email) VALUES (?, ?)').run(id, body.email?.toLowerCase()?.trim() || '');

  return NextResponse.json({ id }, { status: 201 });
}
