import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';

/** DELETE /api/driver-hours/[id] — Delete a driver hours record */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  db.prepare('DELETE FROM driver_hours WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
