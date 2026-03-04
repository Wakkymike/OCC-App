import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';
import { v4 as uuidv4 } from 'uuid';

/** GET /api/driver-hours — Get driver hours records */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const records = db.prepare('SELECT * FROM driver_hours ORDER BY createdAt DESC LIMIT 50').all().map((r: any) => {
    const data = JSON.parse(r.data || '{}');
    return {
      id: r.id,
      ...data,
      createdAt: r.createdAt,
    };
  });

  return NextResponse.json(records);
}

/** POST /api/driver-hours — Save a driver hours record */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const id = uuidv4();

  const db = getDb();
  db.prepare('INSERT INTO driver_hours (id, userId, data) VALUES (?, ?, ?)').run(
    id,
    user.id,
    JSON.stringify(body),
  );

  return NextResponse.json({ id }, { status: 201 });
}
