import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

async function readJsonFile(filePath: string) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

export const dynamic = 'force-dynamic';

export async function GET() {
    const [journeys, timetables, stopNames] = await Promise.all([
        readJsonFile(path.join(process.cwd(), 'src', 'lib', 'journeys.json')),
        readJsonFile(path.join(process.cwd(), 'src', 'lib', 'timetable-data.json')),
        readJsonFile(path.join(process.cwd(), 'src', 'lib', 'stop-names.json')),
    ]);

    if (!journeys || !timetables || !stopNames) {
        return NextResponse.json(
            { error: "Timetable data not yet generated. Please upload a TransXchange file in the Admin Panel." }, 
            { status: 404 }
        );
    }

    const services: any = {};

    for (const journey of journeys) {
        const serviceName = journey.serviceName;
        if (!services[serviceName]) {
            services[serviceName] = {
                service: serviceName,
                journeys: [],
            };
        }
        
        const journeyTimetable = timetables[journey.journeyRef];
        if (!journeyTimetable) continue;

        services[serviceName].journeys.push({
            journeyRef: journey.journeyRef,
            departureTime: journey.departureTime,
            destination: journey.destinationDisplay,
            stops: journeyTimetable.map((stop: any) => ({
                time: stop.time,
                name: stopNames[stop.stop] || stop.stop,
            })),
        });
    }
    
    // Sort journeys by departure time within each service
    for (const serviceName in services) {
        services[serviceName].journeys.sort((a: any, b: any) => a.departureTime.localeCompare(b.departureTime));
    }

    // Sort services numerically
    const sortedServices = Object.values(services).sort((a: any, b: any) => {
        const numA = parseInt(a.service, 10);
        const numB = parseInt(b.service, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.service.localeCompare(b.service);
    });

    return NextResponse.json({ services: sortedServices });
}
