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

        const timetable: any = {};
        const routeGeometry: any = {};
        const routeMetadata: any = {};
        let filesProcessed = 0;

        for (const filename in zip.files) {
            if (filename.toLowerCase().endsWith('.xml')) {
                const xmlContent = await zip.files[filename].async('string');
                const data = parser.parse(xmlContent)?.TransXChange;
                if (!data) continue;
                filesProcessed++;

                const stopPointsCoords: Record<string, { lat: number; lng: number }> = {};
                const stopPoints = ensureArray(data.StopPoints?.StopPoint);
                for (const sp of stopPoints) {
                    if (sp.AtcoCode && sp.Place?.Location?.Latitude && sp.Place?.Location?.Longitude) {
                        stopPointsCoords[sp.AtcoCode] = {
                            lat: parseFloat(sp.Place.Location.Latitude),
                            lng: parseFloat(sp.Place.Location.Longitude),
                        };
                    }
                }

                const journeyPatterns: any = {};
                const services = ensureArray(data.Services?.Service);
                for (const service of services) {
                    const serviceName = service.Lines?.Line?.LineName ?? 'Unknown';
                    const patterns = ensureArray(service.StandardService?.JourneyPattern);
                    for (const pattern of patterns) {
                        if (pattern.id) {
                            journeyPatterns[pattern.id] = pattern;
                            
                            const routePath: {lat: number, lng: number}[] = [];
                            const sections = ensureArray(pattern.JourneyPatternSection);
                            let isFirstLinkOfPattern = true;

                            for (const section of sections) {
                                const timingLinks = ensureArray(section.JourneyPatternTimingLink);
                                for (const link of timingLinks) {
                                    const fromStopRef = link.From?.StopPointRef;
                                    if (isFirstLinkOfPattern && fromStopRef && stopPointsCoords[fromStopRef]) {
                                        routePath.push(stopPointsCoords[fromStopRef]);
                                    }
                                    isFirstLinkOfPattern = false;
                                    
                                    const toStopRef = link.To?.StopPointRef;
                                    if (toStopRef && stopPointsCoords[toStopRef]) {
                                        routePath.push(stopPointsCoords[toStopRef]);
                                    }
                                }
                            }
                            if (routePath.length > 1) {
                                routeGeometry[pattern.id] = routePath;
                                routeMetadata[pattern.id] = {
                                    name: `Service ${serviceName}: ${pattern.DestinationDisplay}`,
                                    service: serviceName,
                                    destination: pattern.DestinationDisplay,
                                    direction: pattern.Direction,
                                    id: pattern.id,
                                };
                            }
                        }
                    }
                }

                const vehicleJourneys = ensureArray(data.VehicleJourneys?.VehicleJourney);
                for (const vj of vehicleJourneys) {
                    const journeyRef = vj.VehicleJourneyCode;
                    const departureTimeStr = vj.DepartureTime;
                    const journeyPatternRef = vj.JourneyPatternRef;

                    if (!journeyRef || !departureTimeStr || !journeyPatternRef || !journeyPatterns[journeyPatternRef]) {
                        continue;
                    }

                    const pattern = journeyPatterns[journeyPatternRef];
                    const departureTime = dateFnsParse(departureTimeStr, 'HH:mm:ss', new Date(0));
                    if (isNaN(departureTime.getTime())) continue;

                    let currentTime = departureTime;
                    const stopTimes: { stop: string; time: string }[] = [];
                    const sections = ensureArray(pattern.JourneyPatternSection);

                    let isFirstLinkOfJourney = true;

                    for (const section of sections) {
                        const timingLinks = ensureArray(section.JourneyPatternTimingLink);
                        for (const link of timingLinks) {
                            if (isFirstLinkOfJourney) {
                                stopTimes.push({
                                    stop: link.From.StopPointRef,
                                    time: currentTime.toTimeString().split(' ')[0],
                                });
                                isFirstLinkOfJourney = false;
                            }

                            const runTime = parseISO8601Duration(link.RunTime);
                            const arrivalAtTo = add(currentTime, runTime);
                            stopTimes.push({
                                stop: link.To.StopPointRef,
                                time: arrivalAtTo.toTimeString().split(' ')[0],
                            });

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

        const timetableFilePath = path.join(process.cwd(), 'src', 'lib', 'timetable-data.json');
        await fs.writeFile(timetableFilePath, JSON.stringify(timetable, null, 2));

        const routeGeometryFilePath = path.join(process.cwd(), 'src', 'lib', 'route-geometry.json');
        await fs.writeFile(routeGeometryFilePath, JSON.stringify(routeGeometry, null, 2));
        
        const routeMetadataFilePath = path.join(process.cwd(), 'src', 'lib', 'route-metadata.json');
        await fs.writeFile(routeMetadataFilePath, JSON.stringify(routeMetadata, null, 2));

        return NextResponse.json({ message: `Successfully processed ${filesProcessed} file(s) and created timetable and route geometry references.` }, { status: 200 });

    } catch (error: any) {
        console.error('TransXchange upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
