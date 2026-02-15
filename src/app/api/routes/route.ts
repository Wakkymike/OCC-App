
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Helper function to read a JSON file safely
async function readJsonFile(filePath: string) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File not found, return empty object which is a valid state
            return {};
        }
        // For other errors (e.g., JSON parsing), log and re-throw
        console.error(`Error reading or parsing ${filePath}:`, error);
        throw error;
    }
}

export async function GET() {
    try {
        const metadataPath = path.join(process.cwd(), 'src', 'lib', 'route-metadata.json');
        const geometryPath = path.join(process.cwd(), 'src', 'lib', 'route-geometry.json');
        const preRecordedPath = path.join(process.cwd(), 'src', 'lib', 'pre-recorded-routes.json');

        // Fetch all data in parallel
        const [metadata, geometry, preRecordedRoutes] = await Promise.all([
            readJsonFile(metadataPath),
            readJsonFile(geometryPath),
            readJsonFile(preRecordedPath),
        ]);
        
        const txcRoutes: Record<string, { name: string; route: any[]; busId: string | null }> = {};

        // Process routes from TransXchange data
        for (const id in metadata) {
            if (geometry[id]) {
                txcRoutes[id] = {
                    name: metadata[id].name,
                    route: geometry[id],
                    busId: null, // TXC routes are templates, not live recordings
                };
            }
        }

        // Combine pre-recorded routes with TXC routes
        // Pre-recorded routes will be overwritten by TXC routes if they share an ID.
        const combinedRoutes = {
            ...preRecordedRoutes,
            ...txcRoutes,
        };
        
        return NextResponse.json({ txcRoutes: combinedRoutes });

    } catch (error) {
        console.error('Error in /api/routes:', error);
        return NextResponse.json(
            { error: 'Failed to load route data from server.' },
            { status: 500 }
        );
    }
}
