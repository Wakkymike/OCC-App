
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'bus-stops.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json({ stops: data });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ stops: [] });
    }
    console.error('Error reading bus stops:', error);
    return NextResponse.json({ error: 'Failed to load bus stops' }, { status: 500 });
  }
}
