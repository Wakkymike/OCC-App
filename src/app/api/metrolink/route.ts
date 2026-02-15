import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { MetrolinkData } from '@/lib/types';

// This will make the route dynamic and prevent caching
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'metrolink-data.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data: MetrolinkData = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error: any) {
    // If the file doesn't exist or has an error, return empty data structure.
    if (error.code === 'ENOENT') {
      return NextResponse.json({ stops: [], lines: [] });
    }
    console.error('Error reading metrolink data:', error);
    return NextResponse.json({ error: 'Failed to load Metrolink data' }, { status: 500 });
  }
}
