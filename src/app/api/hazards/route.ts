import { NextResponse } from 'next/server';
import type { Hazard } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
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
      throw new Error(`Overpass API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const elements = data.elements || [];

    const hazards: Hazard[] = elements.map((el: any) => {
      const lat = el.lat || (el.center && el.center.lat);
      const lng = el.lon || (el.center && el.center.lon);
      
      if (!lat || !lng) return null;

      const maxHeight = el.tags?.maxheight;
      const maxWidth = el.tags?.maxwidth;
      
      let type: 'height' | 'width' | 'both' = 'height';
      let value = '';
      
      if (maxHeight && maxWidth) {
        type = 'both';
        value = `H: ${maxHeight}, W: ${maxWidth}`;
      } else if (maxHeight) {
        type = 'height';
        value = `H: ${maxHeight}`;
      } else if (maxWidth) {
        type = 'width';
        value = `W: ${maxWidth}`;
      }

      return {
        id: `hazard-${el.id}`,
        type,
        value,
        location: { lat, lng },
        description: el.tags?.description || el.tags?.name || `${type.charAt(0).toUpperCase() + type.slice(1)} Restriction`,
      };
    }).filter((h: Hazard | null): h is Hazard => h !== null);

    return NextResponse.json({ hazards });
  } catch (error: any) {
    console.error('Error fetching hazards from Overpass:', error);
    return NextResponse.json(
      { error: `Failed to retrieve road restrictions: ${error.message}` },
      { status: 500 }
    );
  }
}
