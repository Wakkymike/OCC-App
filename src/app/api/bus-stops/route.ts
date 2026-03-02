import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Server-side cache to keep the map responsive
let cachedStops: any[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

export async function GET() {
  const now = Date.now();

  if (cachedStops && (now - lastFetchTime < CACHE_DURATION)) {
    return NextResponse.json({ stops: cachedStops, source: 'cache' });
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
