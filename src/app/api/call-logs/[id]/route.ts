import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';

/** PATCH /api/call-logs/[id] — Update a call log */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const log = db.prepare('SELECT userId FROM call_logs WHERE id = ?').get(id) as any;
  if (!log || log.userId !== user.id) {
    return NextResponse.json({ error: 'Not found or not authorized.' }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = [
    'date', 'callTime', 'employeeNumber', 'fleetNumber', 'runningBoard',
    'serviceNumber', 'depot', 'phoneNumber', 'timeFrom', 'timeTo', 'details',
    'isTeamsRelated', 'isTicketerRelated', 'isEPMRelated', 'isIRRelated',
    'isTSIRelated', 'isDriverReportRelated',
  ];
  const boolFields = new Set([
    'isTeamsRelated', 'isTicketerRelated', 'isEPMRelated', 'isIRRelated',
    'isTSIRelated', 'isDriverReportRelated',
  ]);

  const sets: string[] = [];
  const values: any[] = [];
  for (const key of allowedFields) {
    if (key in body) {
      sets.push(`${key} = ?`);
      values.push(boolFields.has(key) ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (sets.length > 0) {
    values.push(id);
    db.prepare(`UPDATE call_logs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/call-logs/[id] — Delete a call log */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  // Only allow deleting own logs
  const log = db.prepare('SELECT userId FROM call_logs WHERE id = ?').get(id) as any;
  if (!log || log.userId !== user.id) {
    return NextResponse.json({ error: 'Not found or not authorized.' }, { status: 404 });
  }

  db.prepare('DELETE FROM call_logs WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
