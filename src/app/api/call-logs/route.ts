import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';
import { v4 as uuidv4 } from 'uuid';

/** GET /api/call-logs — List call logs for the authenticated user */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Auto-purge records older than 5 days
  db.prepare(`DELETE FROM call_logs WHERE createdAt < datetime('now', '-5 days')`).run();

  const logs = db.prepare(`
    SELECT * FROM call_logs WHERE userId = ? ORDER BY createdAt DESC
  `).all(user.id).map((l: any) => ({
    ...l,
    isTeamsRelated: !!l.isTeamsRelated,
    isTicketerRelated: !!l.isTicketerRelated,
    isEPMRelated: !!l.isEPMRelated,
    isIRRelated: !!l.isIRRelated,
    isTSIRelated: !!l.isTSIRelated,
    isDriverReportRelated: !!l.isDriverReportRelated,
  }));

  return NextResponse.json(logs);
}

/** POST /api/call-logs — Create a new call log */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const id = uuidv4();

  const db = getDb();
  db.prepare(`
    INSERT INTO call_logs (id, userId, date, callTime, employeeNumber, fleetNumber, runningBoard,
      serviceNumber, depot, phoneNumber, timeFrom, timeTo, details,
      isTeamsRelated, isTicketerRelated, isEPMRelated, isIRRelated, isTSIRelated, isDriverReportRelated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    user.id,
    body.date || new Date().toISOString().split('T')[0],
    body.callTime || '',
    body.employeeNumber || '',
    body.fleetNumber || '',
    body.runningBoard || '',
    body.serviceNumber || '',
    body.depot || '',
    body.phoneNumber || '',
    body.timeFrom || '',
    body.timeTo || '',
    body.details || '',
    body.isTeamsRelated ? 1 : 0,
    body.isTicketerRelated ? 1 : 0,
    body.isEPMRelated ? 1 : 0,
    body.isIRRelated ? 1 : 0,
    body.isTSIRelated ? 1 : 0,
    body.isDriverReportRelated ? 1 : 0,
  );

  return NextResponse.json({ id }, { status: 201 });
}
