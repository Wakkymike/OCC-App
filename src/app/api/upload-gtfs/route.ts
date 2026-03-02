
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
            if (lines.length === 0) return [];

            // Improved parser to handle commas inside quotes
            const parseCsvLine = (line: string) => {
                const values = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());
                return values.map(v => v.replace(/^"|"$/g, '').trim());
            };

            const headers = parseCsvLine(lines[0]);
            return lines.slice(1).map(line => {
                const values = parseCsvLine(line);
                const obj: any = {};
                headers.forEach((header, i) => {
                    obj[header] = values[i];
                });
                return obj;
            });
        };

        const agencyData = await getCsvData('agency.txt');
        const routesDataRaw = await getCsvData('routes.txt');
        const tripsDataRaw = await getCsvData('trips.txt');
        const shapesDataRaw = await getCsvData('shapes.txt');

        if (!routesDataRaw || !tripsDataRaw || !shapesDataRaw) {
            return NextResponse.json({ error: 'Missing essential GTFS files (routes, trips, or shapes).' }, { status: 400 });
        }

        // 1. Identify Go North West Agency IDs
        const gnwAgencyIds = (agencyData || [])
            .filter(a => {
                const name = a.agency_name?.toLowerCase() || '';
                return name.includes('go north west') || name.includes('gonorthwest');
            })
            .map(a => a.agency_id);

        if (gnwAgencyIds.length === 0 && agencyData && agencyData.length > 0) {
            console.warn("GTFS Warning: No agencies matching 'Go North West' found in agency.txt");
        }

        // 2. Filter Routes (GNW only)
        const routesData = routesDataRaw.filter(r => {
            // Filter by GNW agency ID
            return gnwAgencyIds.includes(r.agency_id);
        });

        const filteredRouteIds = new Set(routesData.map(r => r.route_id));

        // 3. Process Metadata (Filtered)
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

        // 4. Filter Trips & Shapes
        const filteredTrips = tripsDataRaw.filter(t => filteredRouteIds.has(t.route_id));
        const filteredShapeIds = new Set(filteredTrips.map(t => t.shape_id));

        const shapeGeometry: Record<string, { lat: number; lng: number }[]> = {};
        shapesDataRaw.forEach(s => {
            const id = s.shape_id;
            if (filteredShapeIds.has(id)) {
                if (!shapeGeometry[id]) shapeGeometry[id] = [];
                shapeGeometry[id].push({
                    lat: parseFloat(s.shape_pt_lat),
                    lng: parseFloat(s.shape_pt_lon)
                });
            }
        });

        // 5. Link representative shapes to routes and directions
        const routeGeometry: Record<string, any> = {};
        filteredTrips.forEach(t => {
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
            message: `Successfully processed ${Object.keys(metadata).length} Go North West routes and ${Object.keys(routeGeometry).length} directional paths.` 
        });

    } catch (error: any) {
        console.error('GTFS upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
