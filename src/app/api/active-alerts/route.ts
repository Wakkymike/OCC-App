import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket/events';
import { v4 as uuidv4 } from 'uuid';

/** GET /api/active-alerts — List all active alerts */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const alerts = db.prepare('SELECT * FROM active_alerts ORDER BY timestamp DESC').all().map((a: any) => ({
    ...a,
    isAcknowledged: !!a.isAcknowledged,
  }));

  return NextResponse.json({ alerts });
}

/** POST /api/active-alerts — Create a new alert (from AlertMonitor) */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const alertId = uuidv4();
  const historyId = uuidv4();

  const db = getDb();

  const insertAlert = db.prepare(`
    INSERT INTO active_alerts (id, busId, fleetNumber, service, hazardId, monitorId, hazardValue, hazardDescription, isAcknowledged, historyDocId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO alert_history (id, busId, fleetNumber, service, hazardId, monitorId, hazardValue, hazardDescription)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertAlert.run(
      alertId,
      body.busId || '',
      body.fleetNumber || '',
      body.service || '',
      body.hazardId || '',
      body.monitorId || '',
      body.hazardValue || '',
      body.hazardDescription || '',
      historyId,
    );
    insertHistory.run(
      historyId,
      body.busId || '',
      body.fleetNumber || '',
      body.service || '',
      body.hazardId || '',
      body.monitorId || '',
      body.hazardValue || '',
      body.hazardDescription || '',
    );
  });

  transaction();

  emitSocketEvent(SOCKET_EVENTS.ALERT_CREATED, { id: alertId, historyId, ...body });

  return NextResponse.json({ id: alertId, historyId }, { status: 201 });
}
