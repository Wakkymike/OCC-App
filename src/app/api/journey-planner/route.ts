import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { LatLng } from '@/lib/types';

// Helper to calculate Haversine distance between two points
function getDistance(p1: LatLng, p2: LatLng) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// Find the closest point on a route to a given location
function findClosestPointOnRoute(route: LatLng[], point: LatLng): { point: LatLng, index: number, distance: number } {
    let closestPoint = route[0];
    let minDistance = getDistance(route[0], point);
    let closestIndex = 0;

    for (let i = 1; i < route.length; i++) {
        const distance = getDistance(route[i], point);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = route[i];
            closestIndex = i;
        }
    }
    return { point: closestPoint, index: closestIndex, distance: minDistance };
}

async function readJsonFile(filePath: string) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error: any) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const startQuery = searchParams.get('start');
    const endQuery = searchParams.get('end');
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!startQuery || !endQuery || !mapboxToken) {
        return NextResponse.json({ error: 'Start and end queries are required.' }, { status: 400 });
    }

    try {
        // 1. Geocode start and end points in parallel
        const [startRes, endRes] = await Promise.all([
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(startQuery)}.json?country=GB&limit=1&access_token=${mapboxToken}`),
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(endQuery)}.json?country=GB&limit=1&access_token=${mapboxToken}`)
        ]);

        if (!startRes.ok || !endRes.ok) {
            return NextResponse.json({ error: 'Failed to geocode locations.' }, { status: 500 });
        }

        const [startData, endData] = await Promise.all([startRes.json(), endRes.json()]);
        
        if (!startData.features?.[0] || !endData.features?.[0]) {
            return NextResponse.json({ error: 'One or both locations could not be found.' }, { status: 404 });
        }

        const startCoords: LatLng = { lat: startData.features[0].center[1], lng: startData.features[0].center[0] };
        const endCoords: LatLng = { lat: endData.features[0].center[1], lng: endData.features[0].center[0] };

        // 2. Load route data
        const metadataPath = path.join(process.cwd(), 'src', 'lib', 'route-metadata.json');
        const geometryPath = path.join(process.cwd(), 'src', 'lib', 'route-geometry.json');
        const [metadata, geometry] = await Promise.all([
            readJsonFile(metadataPath),
            readJsonFile(geometryPath),
        ]);

        if (Object.keys(geometry).length === 0) {
            return NextResponse.json({ error: 'No bus routes have been loaded into the system. Please upload TransXchange data.' }, { status: 503 });
        }

        // 3. Find the best route (heuristic: minimize sum of distances from start/end points to the route)
        let bestRoute = {
            id: '',
            score: Infinity,
            startStop: { point: {lat: 0, lng: 0}, index: 0 },
            endStop: { point: {lat: 0, lng: 0}, index: 0 },
        };
        
        for (const id in geometry) {
            const routePath = geometry[id] as LatLng[];
            if (routePath.length < 2) continue;

            const startStop = findClosestPointOnRoute(routePath, startCoords);
            const endStop = findClosestPointOnRoute(routePath, endCoords);

            // Basic check to ensure the journey is in the right direction
            if (startStop.index >= endStop.index) {
                continue;
            }

            // Score is the sum of walking distances to the start and from the end stop. Lower is better.
            const score = startStop.distance + endStop.distance;

            if (score < bestRoute.score) {
                bestRoute = {
                    id: id,
                    score: score,
                    startStop: { point: startStop.point, index: startStop.index },
                    endStop: { point: endStop.point, index: endStop.index },
                };
            }
        }
        
        if (!bestRoute.id) {
            return NextResponse.json({ error: 'Could not find a direct bus route. Please try different locations.' }, { status: 404 });
        }
        
        // 4. Construct the response
        const routeMetadata = metadata[bestRoute.id];
        const routeGeometry = geometry[bestRoute.id];
        
        // We only want the part of the route between the start and end stops
        const journeyPath = routeGeometry.slice(bestRoute.startStop.index, bestRoute.endStop.index + 1);

        const response = {
            service: routeMetadata.service,
            destination: routeMetadata.destination,
            routeName: routeMetadata.name,
            startStop: bestRoute.startStop.point,
            endStop: bestRoute.endStop.point,
            path: journeyPath,
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Journey planner error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred while planning the journey.' }, { status: 500 });
    }
}
