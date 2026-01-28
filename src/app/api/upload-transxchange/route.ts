import { NextRequest, NextResponse } from 'next/server';
import jszip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs/promises';
import path from 'path';
import { add, parse as dateFnsParse, Duration } from 'date-fns';

// Helper to parse ISO 8601 duration strings (e.g., "PT1M30S")
const parseISO8601Duration = (duration: string): Duration => {
    if (!duration || !duration.startsWith('PT')) return {};
    const matches = duration.match(/(\d+H)?(\d+M)?(\d+S)?/);
    if (!matches) return {};
    return {
        hours: matches[1] ? parseInt(matches[1].replace('H', '')) : 0,
        minutes: matches[2] ? parseInt(matches[2].replace('M', '')) : 0,
        seconds: matches[3] ? parseInt(matches[3].replace('S', '')) : 0,
    };
};

const ensureArray = (item: any) => {
    if (!item) return [];
    if (Array.isArray(item)) return item;
    return [item];
};

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
        }
        if (!file.name.endsWith('.zip')) {
            return NextResponse.json({ error: 'Invalid file type. Please upload a ZIP file.' }, { status: 400 });
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const zip = await jszip.loadAsync(fileBuffer);
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true });

        const journeyPatterns: any = {};
        const timetable: any = {};
        let filesProcessed = 0;

        for (const filename in zip.files) {
            if (filename.toLowerCase().endsWith('.xml')) {
                const xmlContent = await zip.files[filename].async('string');
                const data = parser.parse(xmlContent)?.TransXChange;
                if (!data) continue;
                filesProcessed++;

                // 1. Parse JourneyPatterns
                const services = ensureArray(data.Services?.Service);
                for (const service of services) {
                    const patterns = ensureArray(service.StandardService?.JourneyPattern);
                    for (const pattern of patterns) {
                        if (pattern.id) {
                            journeyPatterns[pattern.id] = pattern;
                        }
                    }
                }

                // 2. Parse VehicleJourneys and build timetable
                const vehicleJourneys = ensureArray(data.VehicleJourneys?.VehicleJourney);
                for (const vj of vehicleJourneys) {
                    // FIX: Use the official VehicleJourneyCode, not the internal TicketMachine.JourneyCode
                    const journeyRef = vj.VehicleJourneyCode;
                    const departureTimeStr = vj.DepartureTime;
                    const journeyPatternRef = vj.JourneyPatternRef;

                    if (!journeyRef || !departureTimeStr || !journeyPatternRef || !journeyPatterns[journeyPatternRef]) {
                        continue;
                    }

                    const pattern = journeyPatterns[journeyPatternRef];
                    const departureTime = dateFnsParse(departureTimeStr, 'HH:mm:ss', new Date(0));
                    if (isNaN(departureTime.getTime())) continue;

                    let currentTime = departureTime; // Represents the departure time from the current stop in the loop
                    const stopTimes: { stop: string; time: string }[] = [];
                    const sections = ensureArray(pattern.JourneyPatternSection);

                    let isFirstLinkOfJourney = true;

                    for (const section of sections) {
                        const timingLinks = ensureArray(section.JourneyPatternTimingLink);
                        for (const link of timingLinks) {
                            // For the very first stop of the journey, its event time is the departure time.
                            if (isFirstLinkOfJourney) {
                                stopTimes.push({
                                    stop: link.From.StopPointRef,
                                    time: currentTime.toTimeString().split(' ')[0],
                                });
                                isFirstLinkOfJourney = false;
                            }

                            // Add RunTime to get arrival time at the 'To' stop.
                            const runTime = parseISO8601Duration(link.RunTime);
                            const arrivalAtTo = add(currentTime, runTime);
                            stopTimes.push({
                                stop: link.To.StopPointRef,
                                time: arrivalAtTo.toTimeString().split(' ')[0],
                            });

                            // The next `currentTime` is the departure from this 'To' stop, which includes wait time.
                            const waitTime = link.To.WaitTime ? parseISO8601Duration(link.To.WaitTime) : {};
                            currentTime = add(arrivalAtTo, waitTime);
                        }
                    }
                    timetable[journeyRef] = stopTimes;
                }
            }
        }

        if (filesProcessed === 0) {
            return NextResponse.json({ error: 'No valid Transxchange XML files found in the ZIP.' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src', 'lib', 'timetable-data.json');
        await fs.writeFile(filePath, JSON.stringify(timetable, null, 2));

        return NextResponse.json({ message: `Successfully processed ${filesProcessed} file(s) and created timetable reference.` }, { status: 200 });

    } catch (error: any) {
        console.error('TransXchange upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
