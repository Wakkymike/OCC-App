import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic'; // Ensure fresh data on every request

export async function GET() {
  const RSS_URL = 'https://nationalhighways.co.uk/travel-updates/rss-feed/?region=north-west';

  try {
    // Attempting a direct fetch, which is simpler and more reliable than a public proxy.
    // The `cache: 'no-store'` ensures we get fresh data every time.
    const response = await fetch(RSS_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      // Log the specific error and status for better debugging
      console.error(`Direct fetch failed with status: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch the RSS feed directly. Status: ${response.status}`);
    }

    const xmlText = await response.text();

    if (!xmlText) {
      throw new Error("The RSS feed returned empty content.");
    }
    
    let parsedData;
    try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '',
        });
        parsedData = parser.parse(xmlText);
    } catch (parseError) {
        console.error("Failed to parse XML:", parseError, "XML Content:", xmlText.slice(0, 500));
        throw new Error("Failed to parse the travel news feed.");
    }

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
