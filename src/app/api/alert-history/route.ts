import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';

/** GET /api/alert-history — List all alert history */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const history = db.prepare('SELECT * FROM alert_history ORDER BY timestamp DESC').all();

  return NextResponse.json({ history });
}
