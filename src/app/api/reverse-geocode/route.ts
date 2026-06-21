import { NextRequest, NextResponse } from 'next/server';

/**
 * Reverse-geocode a lat/lng to a UK postcode using a self-hosted Nominatim
 * instance running on the same machine (localhost:8080).
 *
 * Query params: ?lat=53.48&lng=-2.24
 *
 * Falls back to the public Nominatim instance if the local one is unavailable,
 * respecting their usage policy (1 req/s, identify via User-Agent).
 */

const LOCAL_NOMINATIM = process.env.NOMINATIM_URL || 'http://127.0.0.1:8080';

// Simple in-memory cache: "lat,lng" → { postcode, locality, cachedAt }
const cache = new Map<string, { postcode: string | null; locality: string | null; cachedAt: number }>();
const CACHE_TTL = 60_000; // 60 seconds — buses move, but not *that* fast

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng query parameters are required' }, { status: 400 });
  }

  // Round to 4 decimal places (~11 m) for cache key — same postcode area
  const cacheKey = `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({ postcode: cached.postcode, locality: cached.locality });
  }

  try {
    const url = `${LOCAL_NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OCC-App/1.0' },
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ postcode: null, locality: null });
    }

    const data = await res.json();
    const postcode = data.address?.postcode ?? null;
    const locality =
      data.address?.suburb ??
      data.address?.neighbourhood ??
      data.address?.village ??
      data.address?.town ??
      data.address?.city ??
      null;

    cache.set(cacheKey, { postcode, locality, cachedAt: Date.now() });

    // Prune cache if it grows too large (> 2000 entries)
    if (cache.size > 2000) {
      const cutoff = Date.now() - CACHE_TTL;
      for (const [key, val] of cache) {
        if (val.cachedAt < cutoff) cache.delete(key);
      }
    }

    return NextResponse.json({ postcode, locality });
  } catch {
    return NextResponse.json({ postcode: null, locality: null });
  }
}
