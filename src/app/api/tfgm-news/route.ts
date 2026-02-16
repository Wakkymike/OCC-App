import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET() {
  // Switched to National Highways feed for North West England as requested.
  const RSS_URL = 'https://nationalhighways.co.uk/travel-updates/rss-feed/?region=north-west';

  // We use a proxy to prevent any network or CORS issues.
  const PROXY_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(RSS_URL)}`;

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
    console.error('Error fetching or parsing travel news RSS feed:', error);
    return NextResponse.json(
      { error: `Failed to retrieve travel news: ${error.message}` },
      { status: 500 }
    );
  }
}
