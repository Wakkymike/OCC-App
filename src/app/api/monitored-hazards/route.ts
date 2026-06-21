import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket/events';
import { v4 as uuidv4 } from 'uuid';

/** GET /api/monitored-hazards — List all monitored hazards */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const hazards = db.prepare('SELECT * FROM monitored_hazards ORDER BY createdAt DESC').all().map((h: any) => ({
    id: h.id,
    hazardId: h.hazardId,
    type: h.type,
    value: h.value,
    location: { lat: h.locationLat, lng: h.locationLng },
    geofenceCenter: h.geofenceCenterLat != null ? { lat: h.geofenceCenterLat, lng: h.geofenceCenterLng } : undefined,
    description: h.description,
    radius: h.radius,
    createdAt: h.createdAt,
  }));

  return NextResponse.json({ hazards });
}

/** POST /api/monitored-hazards — Create a new monitored hazard */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin && !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const id = uuidv4();

  const db = getDb();
  db.prepare(`
    INSERT INTO monitored_hazards (id, hazardId, type, value, locationLat, locationLng, geofenceCenterLat, geofenceCenterLng, description, radius)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.hazardId || 'manual',
    body.type || 'manual',
    body.value || '',
    body.location?.lat ?? 0,
    body.location?.lng ?? 0,
    body.geofenceCenter?.lat ?? null,
    body.geofenceCenter?.lng ?? null,
    body.description || '',
    body.radius ?? 50,
  );

  emitSocketEvent(SOCKET_EVENTS.HAZARD_CHANGED, { id });

  return NextResponse.json({ id }, { status: 201 });
}
