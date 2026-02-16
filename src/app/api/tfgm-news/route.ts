import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET() {
  const TFGM_RSS_URL = 'https://tfgm.com/public-transport/rss/travel-updates-rss.xml';

  try {
    const response = await fetch(TFGM_RSS_URL, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
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
