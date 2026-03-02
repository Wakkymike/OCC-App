
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const geometryPath = path.join(process.cwd(), 'src', 'lib', 'gtfs-geometry.json');
        const fileContent = await fs.readFile(geometryPath, 'utf-8');
        const gtfsRoutes = JSON.parse(fileContent);
        
        return NextResponse.json({ gtfsRoutes });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ gtfsRoutes: {} });
        }
        return NextResponse.json({ error: 'Failed to load GTFS data' }, { status: 500 });
    }
}
