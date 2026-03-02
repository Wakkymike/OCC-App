
import { NextRequest, NextResponse } from 'next/server';
import jszip from 'jszip';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const zip = await jszip.loadAsync(fileBuffer);

        const getCsvData = async (filename: string) => {
            const file = zip.file(filename);
            if (!file) return null;
            const content = await file.async('string');
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                const obj: any = {};
                headers.forEach((header, i) => {
                    obj[header] = values[i];
                });
                return obj;
            });
        };

        const routesData = await getCsvData('routes.txt');
        const tripsData = await getCsvData('trips.txt');
        const shapesData = await getCsvData('shapes.txt');

        if (!routesData || !tripsData || !shapesData) {
            return NextResponse.json({ error: 'Missing essential GTFS files (routes, trips, or shapes).' }, { status: 400 });
        }

        // 1. Process Metadata (Routes)
        const metadata: Record<string, any> = {};
        routesData.forEach(r => {
            const id = r.route_id;
            metadata[id] = {
                id,
                shortName: r.route_short_name,
                longName: r.route_long_name,
                name: `${r.route_short_name} ${r.route_long_name}`,
            };
        });

        // 2. Process Geometry (Shapes linked to Routes)
        const shapeGeometry: Record<string, { lat: number; lng: number }[]> = {};
        shapesData.forEach(s => {
            const id = s.shape_id;
            if (!shapeGeometry[id]) shapeGeometry[id] = [];
            shapeGeometry[id].push({
                lat: parseFloat(s.shape_pt_lat),
                lng: parseFloat(s.shape_pt_lon)
            });
        });

        // 3. Link representative shapes to routes and directions
        const routeGeometry: Record<string, any> = {};
        tripsData.forEach(t => {
            const routeId = t.route_id;
            const directionId = t.direction_id || '0';
            const shapeId = t.shape_id;

            if (routeId && shapeId && shapeGeometry[shapeId]) {
                const key = `${routeId}-${directionId}`;
                if (!routeGeometry[key]) {
                    routeGeometry[key] = {
                        routeId,
                        direction: directionId === '0' ? 'Inbound' : 'Outbound',
                        path: shapeGeometry[shapeId],
                        name: metadata[routeId]?.name || `Route ${routeId}`
                    };
                }
            }
        });

        await fs.writeFile(path.join(process.cwd(), 'src', 'lib', 'gtfs-geometry.json'), JSON.stringify(routeGeometry, null, 2));
        await fs.writeFile(path.join(process.cwd(), 'src', 'lib', 'gtfs-metadata.json'), JSON.stringify(metadata, null, 2));

        return NextResponse.json({ 
            message: `Successfully processed ${Object.keys(metadata).length} routes and ${Object.keys(routeGeometry).length} directional paths.` 
        });

    } catch (error: any) {
        console.error('GTFS upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
