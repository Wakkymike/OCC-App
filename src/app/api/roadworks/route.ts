import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { Roadwork } from '@/lib/types';

// Function to determine severity from text
const getSeverity = (text: string): 'low' | 'moderate' | 'high' => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('severe') || lowerText.includes('high') || lowerText.includes('closed')) return 'high';
    if (lowerText.includes('moderate') || lowerText.includes('congestion')) return 'moderate';
    return 'low';
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const RSS_URL = 'https://m.highwaysengland.co.uk/feeds/rss/AllEvents/North%20West.xml';

  try {
    const response = await fetch(RSS_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch the RSS feed. Status: ${response.status}`);
    }

    const xmlText = await response.text();

    if (!xmlText) {
      throw new Error("The RSS feed returned empty content.");
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true, // Easier to handle georss:point as 'point'
    });
    const parsedData = parser.parse(xmlText);

    const items = parsedData?.rss?.channel?.item || [];

    const roadworks: Roadwork[] = items
      .map((item: any, index: number): Roadwork | null => {
        
        const title = item.title || '';
        
        const point = item.point;
        if (!point || typeof point !== 'string') {
          return null;
        }

        const [latStr, lngStr] = point.split(' ');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        if (isNaN(lat) || isNaN(lng)) {
          return null;
        }

        const description = item.description || '';
        const severity = getSeverity(title + ' ' + description);

        return {
          id: item.guid || `roadwork-${index}`,
          title: title,
          description: description,
          location: { lat, lng },
          severity: severity,
          link: item.link,
          pubDate: item.pubDate,
        };
      })
      .filter((item: Roadwork | null): item is Roadwork => item !== null);

    return NextResponse.json({ roadworks });

  } catch (error: any) {
    console.error('Error fetching or parsing roadworks RSS feed:', error);
    return NextResponse.json(
      { error: `Failed to retrieve roadworks data: ${error.message}` },
      { status: 500 }
    );
  }
}
