
import { NextResponse } from 'next/server';
import type { Hazard } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Simple in-memory cache to prevent hitting Overpass API rate limits (429)
let cachedHazards: Hazard[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache duration

/**
 * Converts a measurement string (likely in meters or feet/inches) to a formatted feet and inches string.
 * OSM 'maxheight' and 'maxwidth' can be "4.2", "4.2m", "14'6\"", etc.
 */
function formatToImperial(val: string | undefined): string | null {
  if (!val) return null;

  // If it's already in feet/inches format, just return it sanitized
  if (val.includes("'") || val.includes('"')) {
    return val.trim();
  }

  // Handle metric values (e.g., "4.2" or "4.2m")
  const metricMatch = val.match(/^(\d+(\.\d+)?)\s*(m)?$/i);
  if (metricMatch) {
    const meters = parseFloat(metricMatch[1]);
    if (isNaN(meters)) return null;

    // 1 meter = 39.3701 inches
    const totalInches = meters * 39.3701;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);

    // If rounding puts us at 12 inches, bump the feet
    if (inches === 12) {
      return `${feet + 1}' 0"`;
    }

    return `${feet}' ${inches}"`;
  }

  return null;
}

export async function GET() {
  const now = Date.now();

  // Return cached data if it's still fresh
  if (cachedHazards && (now - lastFetchTime < CACHE_DURATION)) {
    return NextResponse.json({ hazards: cachedHazards, source: 'cache' });
  }

  // Bounding box for North West (approx: Manchester, Bolton, Salford area)
  // [south, west, north, east]
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
      if (response.status === 429 && cachedHazards) {
        console.warn('Overpass API rate limited (429). Falling back to stale cache.');
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

      // If we couldn't parse any actual value, skip this element
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

      // We only return it if we have a real value to show
      return {
        id: `hazard-${el.id}`,
        type,
        value,
        location: { lat, lng },
        description: el.tags?.description || el.tags?.name || '', // No "Default Restriction" label
      };
    }).filter((h: Hazard | null): h is Hazard => h !== null);

    // Update the cache
    cachedHazards = hazards;
    lastFetchTime = now;

    return NextResponse.json({ hazards, source: 'live' });
  } catch (error: any) {
    console.error('Error fetching hazards from Overpass:', error);
    
    // Fallback to cache on any error if possible
    if (cachedHazards) {
        return NextResponse.json({ hazards: cachedHazards, source: 'error-fallback-cache' });
    }

    return NextResponse.json(
      { error: `Failed to retrieve road restrictions: ${error.message}` },
      { status: 500 }
    );
  }
}
