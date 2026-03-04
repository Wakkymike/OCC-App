import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket/events';

/** PATCH /api/network-updates/[id] — Update a network update */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !user.isContentCreator && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const db = getDb();

  const setClauses: string[] = [];
  const values: any[] = [];

  for (const key of ['title', 'details', 'priority', 'isVisible']) {
    if (body[key] !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(typeof body[key] === 'boolean' ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  values.push(id);
  db.prepare(`UPDATE network_updates SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

  emitSocketEvent(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, { id });

  return NextResponse.json({ success: true });
}

/** DELETE /api/network-updates/[id] — Delete a network update */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !user.isContentCreator && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  db.prepare('DELETE FROM network_updates WHERE id = ?').run(id);

  emitSocketEvent(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, { id, deleted: true });

  return NextResponse.json({ success: true });
}
