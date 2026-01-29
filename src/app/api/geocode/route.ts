import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!mapboxToken) {
    return NextResponse.json(
      { error: "Server configuration error: Mapbox token is missing." },
      { status: 500 }
    );
  }

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required.' }, { status: 400 });
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?country=GB&limit=1&access_token=${mapboxToken}`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Mapbox Geocoding API error: ${response.status}`, errorText);
        return NextResponse.json({ error: 'Failed to fetch geocoding data.' }, { status: response.status });
    }
    
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return NextResponse.json({ coordinates: { lat, lng } });
    } else {
      return NextResponse.json({ coordinates: null, error: 'No results found.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Geocoding API route error:', error);
    return NextResponse.json(
        { error: `Unexpected server error: ${error instanceof Error ? error.message : String(error)}` },
        { status: 500 }
    );
  }
}
