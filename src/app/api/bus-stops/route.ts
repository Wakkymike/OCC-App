import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Persistent disk cache so we don't hammer Overpass on every dev-server restart
const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'bus-stops-cache.json');
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// In-memory cache (fast path)
let cachedStops: any[] | null = null;
let lastFetchTime = 0;

function loadDiskCache(): boolean {
  try {
    if (!fs.existsSync(CACHE_FILE)) return false;
    const stat = fs.statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_DURATION) return false;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (Array.isArray(data) && data.length > 0) {
      cachedStops = data;
      lastFetchTime = stat.mtimeMs;
      return true;
    }
  } catch { /* ignore corrupt cache */ }
  return false;
}

function saveDiskCache(stops: any[]) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(stops));
  } catch (e) {
    console.warn('Failed to write bus-stops cache:', e);
  }
}

export async function GET() {
  const now = Date.now();

  // 1) In-memory cache hit
  if (cachedStops && (now - lastFetchTime < CACHE_DURATION)) {
    return NextResponse.json({ stops: cachedStops, source: 'cache' });
  }

  // 2) Disk cache hit (survives server restarts)
  if (loadDiskCache()) {
    return NextResponse.json({ stops: cachedStops, source: 'disk-cache' });
  }

  // Bounding box for Greater Manchester area (approx Bolton to Manchester)
  const bbox = '53.34,-2.68,53.65,-2.10';
  const query = `
    [out:json][timeout:60];
    (
      node["highway"="bus_stop"](${bbox});
      node["public_transport"="platform"]["bus"="yes"](${bbox});
    );
    out body;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Overpass API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    const stops = data.elements.map((el: any) => {
      // Prioritize official NaPTAN AtcoCodes stored in OSM tags
      const atcoCode = el.tags?.['naptan:AtcoCode'] || 
                       el.tags?.['ref'] || 
                       el.tags?.['local_ref'] || 
                       `osm-${el.id}`;
      
      const name = el.tags?.name || el.tags?.description || 'Unnamed Stop';

      return {
        atcoCode,
        name,
        lat: el.lat,
        lng: el.lon,
      };
    }).filter((s: any) => s.lat && s.lng);

    // Filter duplicates by AtcoCode
    const uniqueStops = Array.from(new Map(stops.map((s: any) => [s.atcoCode, s])).values());

    cachedStops = uniqueStops;
    lastFetchTime = now;
    saveDiskCache(uniqueStops as any[]);

    return NextResponse.json({ stops: uniqueStops, source: 'live' });
  } catch (error: any) {
    console.error('Error fetching real-world bus stops:', error);
    
    // Fallback to cache if available on error
    if (cachedStops) {
        return NextResponse.json({ stops: cachedStops, source: 'error-fallback' });
    }

    return NextResponse.json({ error: 'Failed to retrieve technical stop data' }, { status: 500 });
  }
}
