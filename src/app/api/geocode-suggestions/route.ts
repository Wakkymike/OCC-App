import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  const sessionToken = searchParams.get('session_token');
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!mapboxToken) {
    return NextResponse.json(
      { error: "Server configuration error: Mapbox token is missing." },
      { status: 500 }
    );
  }

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session token is required for suggestions.' }, { status: 400 });
  }

  try {
    const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(
      query
    )}&language=en&country=GB&session_token=${sessionToken}&access_token=${mapboxToken}`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Mapbox Suggest API error: ${response.status}`, errorText);
        return NextResponse.json({ error: 'Failed to fetch geocoding suggestions.' }, { status: response.status });
    }
    
    const data = await response.json();

    return NextResponse.json({ suggestions: data.suggestions || [] });

  } catch (error) {
    console.error('Geocoding suggestions API route error:', error);
    return NextResponse.json(
        { error: `Unexpected server error: ${error instanceof Error ? error.message : String(error)}` },
        { status: 500 }
    );
  }
}
