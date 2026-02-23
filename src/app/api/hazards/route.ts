
import { NextResponse } from 'next/server';
import type { Hazard } from '@/lib/types';

export const dynamic = 'force-dynamic';

let cachedHazards: Hazard[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour caching

/**
 * Converts metric meters to UK standard feet and inches.
 */
function formatToImperial(val: string | undefined): string | null {
  if (!val) return null;

  // If already imperial, just return it
  if (val.includes("'") || val.includes('"')) {
    return val.trim();
  }

  // Extract number from metric string (e.g. "4.2m" or "4.2")
  const metricMatch = val.match(/^(\d+(\.\d+)?)\s*(m)?$/i);
  if (metricMatch) {
    const meters = parseFloat(metricMatch[1]);
    if (isNaN(meters)) return null;

    const totalInches = meters * 39.3701;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);

    // Round up inches if they reach 12
    if (inches === 12) {
      return `${feet + 1}' 0"`;
    }

    return `${feet}' ${inches}"`;
  }

  return null;
}

export async function GET() {
  const now = Date.now();

  // Return cached data if available and fresh
  if (cachedHazards && (now - lastFetchTime < CACHE_DURATION)) {
    return NextResponse.json({ hazards: cachedHazards, source: 'cache' });
  }

  // Bounding box for Greater Manchester/North West area
  const bbox = '53.34,-2.68,53.65,-2.10';
  const query = `
    [out:json][timeout:25];
    (
      node["maxheight"](${bbox});
      way["maxheight"](${bbox});
      node["maxwidth"](${bbox});
      way["maxwidth"](${bbox});
    );
    out center;
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
      // If we're being rate limited but have a cache, return it
      if (response.status === 429 && cachedHazards) {
        return NextResponse.json({ hazards: cachedHazards, source: 'stale-cache' });
      }
      throw new Error(`Overpass API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const elements = data.elements || [];

    const hazards: Hazard[] = elements.map((el: any) => {
      const lat = el.lat || (el.center && el.center.lat);
      const lng = el.lon || (el.center && el.center.lon);
      
      if (!lat || !lng) return null;

      const rawHeight = el.tags?.maxheight;
      const rawWidth = el.tags?.maxwidth;
      
      const heightImperial = formatToImperial(rawHeight);
      const widthImperial = formatToImperial(rawWidth);

      // Only show hazards that have valid measurement data
      if (!heightImperial && !widthImperial) return null;
      
      let type: 'height' | 'width' | 'both' = 'height';
      let value = '';
      
      if (heightImperial && widthImperial) {
        type = 'both';
        value = `H: ${heightImperial}, W: ${widthImperial}`;
      } else if (heightImperial) {
        type = 'height';
        value = `H: ${heightImperial}`;
      } else if (widthImperial) {
        type = 'width';
        value = `W: ${widthImperial}`;
      }

      // We only return the hazard if it has a useful description or tag data, avoiding generic fallbacks
      const description = el.tags?.description || el.tags?.name || el.tags?.operator || '';

      return {
        id: `hazard-${el.id}`,
        type,
        value,
        location: { lat, lng },
        description,
      };
    }).filter((h: Hazard | null): h is Hazard => h !== null);

    cachedHazards = hazards;
    lastFetchTime = now;

    return NextResponse.json({ hazards, source: 'live' });
  } catch (error: any) {
    console.error('Error fetching hazards:', error);
    // Fallback to cache on network failure if available
    if (cachedHazards) {
        return NextResponse.json({ hazards: cachedHazards, source: 'error-fallback' });
    }
    return NextResponse.json(
      { error: `Failed to retrieve road restrictions: ${error.message}` },
      { status: 500 }
    );
  }
}
