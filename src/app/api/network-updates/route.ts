import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket/events';
import { v4 as uuidv4 } from 'uuid';

/** GET /api/network-updates — List all network updates */
export async function GET() {
  const db = getDb();
  const updates = db.prepare(`
    SELECT * FROM network_updates ORDER BY priority ASC, createdAt DESC
  `).all().map((u: any) => ({
    ...u,
    isVisible: !!u.isVisible,
  }));

  return NextResponse.json({ updates });
}

/** POST /api/network-updates — Create a new network update (admin only) */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !user.isContentCreator && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const id = uuidv4();

  const db = getDb();
  db.prepare(`
    INSERT INTO network_updates (id, title, details, priority, isVisible)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, body.title || '', body.details || '', body.priority || 0, body.isVisible !== false ? 1 : 0);

  emitSocketEvent(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, { id });

  return NextResponse.json({ id }, { status: 201 });
}
