import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET() {
  // This is the updated, correct URL for the RSS feed.
  const TFGM_RSS_URL = 'https://tfgm.com/public-transport-disruptions-rss';

  // We use a proxy to prevent any network or CORS issues.
  // The /get endpoint returns a JSON object containing the feed content.
  const PROXY_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(TFGM_RSS_URL)}`;

  try {
    const proxyResponse = await fetch(PROXY_URL, {
      cache: 'no-store',
    });

    if (!proxyResponse.ok) {
      throw new Error(`Failed to fetch from proxy service: ${proxyResponse.statusText}`);
    }

    const proxyJson = await proxyResponse.json();
    const xmlText = proxyJson.contents; // The actual XML content is in this property

    if (!xmlText) {
      throw new Error("Proxy service did not return any content from the RSS feed.");
    }

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
