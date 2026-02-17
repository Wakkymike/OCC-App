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

    // A simple parser configuration is more reliable here.
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseNodeValue: true,
      trimValues: true,
    });
    const parsedData = parser.parse(xmlText);

    const items = parsedData?.rss?.channel?.item || [];

    const roadworks: Roadwork[] = items
      .map((item: any, index: number): Roadwork | null => {
        
        // Directly access the 'georss:point' key and validate it's a string.
        // This is the most robust way to handle this specific feed.
        const pointStr = item['georss:point'];
        
        if (!pointStr || typeof pointStr !== 'string') {
          return null; // Skip item if location is missing or not in the expected format.
        }

        const [latStr, lngStr] = pointStr.split(' ');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        // Skip if coordinates are not valid numbers.
        if (isNaN(lat) || isNaN(lng)) {
          return null;
        }

        const title = item.title || '';
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
