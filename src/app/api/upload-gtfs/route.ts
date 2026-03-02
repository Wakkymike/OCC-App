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
            let content = await file.async('string');
            
            // Strip Byte Order Mark (BOM) if present
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1);
            }

            const lines = content.split(/\r?\n/).filter(line => line.trim());
            if (lines.length === 0) return [];

            // Improved parser to handle commas inside quotes and escaped quotes
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
                // Strip surrounding quotes and trim
                return values.map(v => v.replace(/^"|"$/g, '').trim());
            };

            const headers = parseCsvLine(lines[0]);
            return lines.slice(1).map(line => {
                const values = parseCsvLine(line);
                const obj: any = {};
                headers.forEach((header, i) => {
                    if (header) obj[header] = values[i];
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

        // Specific Agency ID for Go North West
        const TARGET_AGENCY_ID = '7778548';

        // 1. Filter Routes (Agency 7778548 only)
        const routesData = routesDataRaw.filter(r => String(r.agency_id) === TARGET_AGENCY_ID);

        if (routesData.length === 0) {
            const foundAgencies = (agencyData || [])
                .map(a => `${a.agency_name || 'Unnamed'} (ID: ${a.agency_id})`)
                .join(', ');
            
            return NextResponse.json({ 
                error: `No routes found for Agency ID ${TARGET_AGENCY_ID}. Found in file: [${foundAgencies || 'None'}].` 
            }, { status: 404 });
        }

        const filteredRouteIds = new Set(routesData.map(r => r.route_id));

        // 2. Process Metadata
        const metadata: Record<string, any> = {};
        routesData.forEach(r => {
            const id = r.route_id;
            metadata[id] = {
                id,
                shortName: r.route_short_name,
                longName: r.route_long_name,
                name: `${r.route_short_name || ''} ${r.route_long_name || ''}`.trim(),
            };
        });

        // 3. Filter Trips & Shapes
        const filteredTrips = tripsDataRaw.filter(t => filteredRouteIds.has(t.route_id));
        const filteredShapeIds = new Set(filteredTrips.map(t => t.shape_id));

        const shapeGeometry: Record<string, { lat: number; lng: number }[]> = {};
        shapesDataRaw.forEach(s => {
            const id = s.shape_id;
            if (filteredShapeIds.has(id)) {
                const lat = parseFloat(s.shape_pt_lat);
                const lng = parseFloat(s.shape_pt_lon);
                if (!isNaN(lat) && !isNaN(lng)) {
                    if (!shapeGeometry[id]) shapeGeometry[id] = [];
                    shapeGeometry[id].push({ lat, lng });
                }
            }
        });

        // 4. Link representative shapes to routes and directions
        const routeGeometry: Record<string, any> = {};
        filteredTrips.forEach(t => {
            const routeId = t.route_id;
            const directionId = t.direction_id || '0';
            const shapeId = t.shape_id;

            if (routeId && shapeId && shapeGeometry[shapeId]) {
                const key = `${routeId}-${directionId}`;
                // Only take the first shape found for each direction to keep data small
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

        // Ensure the directory exists
        const libPath = path.join(process.cwd(), 'src', 'lib');
        await fs.mkdir(libPath, { recursive: true });

        await fs.writeFile(path.join(libPath, 'gtfs-geometry.json'), JSON.stringify(routeGeometry, null, 2));
        await fs.writeFile(path.join(libPath, 'gtfs-metadata.json'), JSON.stringify(metadata, null, 2));

        return NextResponse.json({ 
            message: `Successfully processed ${Object.keys(metadata).length} Go North West routes for Agency ID ${TARGET_AGENCY_ID}.` 
        });

    } catch (error: any) {
        console.error('GTFS upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
