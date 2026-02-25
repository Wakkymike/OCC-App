import { NextRequest, NextResponse } from 'next/server';
import ical from 'node-ical';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'iCal URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.statusText}`);
    }

    const icsData = await response.text();
    const data = ical.parseICS(icsData);

    const shifts = Object.values(data)
      .filter((item) => item.type === 'VEVENT')
      .map((event: any) => ({
        id: event.uid,
        summary: event.summary,
        start: event.start,
        end: event.end,
        location: event.location || '',
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Extract calendar name/owner info if available
    let calendarName = '';
    // Look for VCALENDAR metadata or X-WR-CALNAME properties
    const metadata = Object.values(data).find(item => item.type === 'VCALENDAR') as any;
    if (metadata) {
      calendarName = metadata['WR-CALNAME'] || metadata['X-WR-CALNAME'] || '';
    } else {
      // Fallback: check root level properties which node-ical sometimes provides
      // Some providers put the name in the first event description or specific fields
      // but X-WR-CALNAME is the standard for "Calendar Name"
      const anyData = data as any;
      calendarName = anyData['vcalendar']?.['WR-CALNAME'] || anyData['vcalendar']?.['X-WR-CALNAME'] || '';
    }

    return NextResponse.json({ shifts, calendarName });
  } catch (error: any) {
    console.error('Shift fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse rota calendar' },
      { status: 500 }
    );
  }
}
