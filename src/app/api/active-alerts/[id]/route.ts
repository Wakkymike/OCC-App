import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket/events';

/** PATCH /api/active-alerts/[id] — Acknowledge an alert */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const db = getDb();
  const now = new Date().toISOString();

  const setClauses: string[] = [];
  const values: any[] = [];

  if (body.isAcknowledged !== undefined) {
    setClauses.push('isAcknowledged = ?');
    values.push(body.isAcknowledged ? 1 : 0);
  }
  if (body.acknowledgedBy !== undefined) {
    setClauses.push('acknowledgedBy = ?');
    values.push(body.acknowledgedBy);
  }
  setClauses.push('acknowledgedAt = ?');
  values.push(now);

  values.push(id);
  db.prepare(`UPDATE active_alerts SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

  // Also update linked history record
  const alert = db.prepare('SELECT historyDocId FROM active_alerts WHERE id = ?').get(id) as any;
  if (alert?.historyDocId) {
    db.prepare(`UPDATE alert_history SET acknowledgedBy = ?, acknowledgedAt = ? WHERE id = ?`)
      .run(body.acknowledgedBy || user.displayName || user.email, now, alert.historyDocId);
  }

  emitSocketEvent(SOCKET_EVENTS.ALERT_ACKNOWLEDGED, { id });

  return NextResponse.json({ success: true });
}

/** DELETE /api/active-alerts/[id] — Delete an alert */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  db.prepare('DELETE FROM active_alerts WHERE id = ?').run(id);

  emitSocketEvent(SOCKET_EVENTS.ALERT_DELETED, { id });

  return NextResponse.json({ success: true });
}
