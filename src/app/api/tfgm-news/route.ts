import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET() {
  const TFGM_RSS_URL = 'https://tfgm.com/public-transport/travel-updates/rss';

  try {
    const response = await fetch(TFGM_RSS_URL, {
      cache: 'no-store', // Force a fresh fetch on every request
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const xmlText = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });

    const parsedData = parser.parse(xmlText);
    const items = parsedData?.rss?.channel?.item || [];

    const newsItems = items.map((item: any) => ({
      title: item.title,
      description: item.description,
      link: item.link,
      pubDate: item.pubDate,
    }));

    return NextResponse.json({ items: newsItems });

  } catch (error: any) {
    console.error('Error fetching or parsing TfGM RSS feed:', error);
    return NextResponse.json(
      { error: `Failed to retrieve travel news: ${error.message}` },
      { status: 500 }
    );
  }
}
