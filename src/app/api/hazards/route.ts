
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Hazard } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Persistent disk + memory cache
const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'hazards-cache.json');
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

let cachedHazards: Hazard[] | null = null;
let lastFetchTime = 0;

function loadDiskCache(): boolean {
  try {
    if (!fs.existsSync(CACHE_FILE)) return false;
    const stat = fs.statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_DURATION) return false;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (Array.isArray(data) && data.length > 0) {
      cachedHazards = data;
      lastFetchTime = stat.mtimeMs;
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

function saveDiskCache(hazards: Hazard[]) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(hazards));
  } catch (e) {
    console.warn('Failed to write hazards cache:', e);
  }
}

/**
 * Converts metric meters to UK standard feet and inches.
 */
function formatToImperial(val: string | undefined): string | null {
  if (!val) return null;

  // If already imperial (e.g. 13' 6"), just return it
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

    // Standard sign formatting
    if (inches === 0) return `${feet}'`;
    if (inches === 12) return `${feet + 1}'`;
    return `${feet}' ${inches}"`;
  }

  return null;
}

export async function GET() {
  const now = Date.now();

  // Return cached data if available and fresh (less than 1 hour old)
  if (cachedHazards && (now - lastFetchTime < CACHE_DURATION)) {
    return NextResponse.json({ hazards: cachedHazards, source: 'cache' });
  }

  // Disk cache (survives restarts)
  if (loadDiskCache()) {
    return NextResponse.json({ hazards: cachedHazards, source: 'disk-cache' });
  }

  // Bounding box for Greater Manchester area
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
      // If the Overpass API is down or timing out (504/502/429), 
      // return the last known good data if we have it.
      if (cachedHazards) {
        console.warn(`Overpass API error ${response.status}. Returning stale cache.`);
        return NextResponse.json({ hazards: cachedHazards, source: 'stale-cache' });
      }
      throw new Error(`Overpass API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Overpass sometimes returns a 200 with a "remark" field containing an error message
    if (data.remark && !data.elements && cachedHazards) {
        return NextResponse.json({ hazards: cachedHazards, source: 'stale-cache-timeout' });
    }

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

      const description = el.tags?.description || el.tags?.name || el.tags?.operator || '';

      return {
        id: `hazard-${el.id}`,
        type,
        value,
        location: { lat, lng },
        description,
      };
    }).filter((h: Hazard | null): h is Hazard => h !== null);

    // Update the cache on successful fetch
    cachedHazards = hazards;
    lastFetchTime = now;
    saveDiskCache(hazards);

    return NextResponse.json({ hazards, source: 'live' });
  } catch (error: any) {
    console.error('Error fetching hazards:', error);
    
    // Global fallback for any unexpected network errors or timeouts
    if (cachedHazards) {
        return NextResponse.json({ hazards: cachedHazards, source: 'error-fallback' });
    }
    
    return NextResponse.json(
      { error: `Failed to retrieve road restrictions: ${error.message}` },
      { status: 500 }
    );
  }
}
