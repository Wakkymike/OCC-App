import { NextRequest, NextResponse } from 'next/server';
import jszip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs/promises';
import path from 'path';
import { add, parse as dateFnsParse, Duration } from 'date-fns';

// Helper to safely extract a text value from a field which might be a string or an object with a #text property.
const getText = (field: any): string | undefined => {
    if (field === undefined || field === null) return undefined;
    if (typeof field === 'object' && '#text' in field) {
        return field['#text'];
    }
    if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
        return String(field);
    }
    return undefined;
};


// Helper to parse ISO 8601 duration strings (e.g., "PT1M30S")
const parseISO8601Duration = (durationStr: string | undefined): Duration => {
    if (!durationStr || !durationStr.startsWith('PT')) return {};

    let remaining = durationStr.substring(2);
    const hoursMatch = remaining.match(/(\d+)H/);
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    if (hoursMatch) remaining = remaining.replace(hoursMatch[0], '');

    const minutesMatch = remaining.match(/(\d+)M/);
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
    if (minutesMatch) remaining = remaining.replace(minutesMatch[0], '');

    const secondsMatch = remaining.match(/(\d+)S/);
    const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;

    return { hours, minutes, seconds };
};

const ensureArray = (item: any) => {
    if (item === undefined || item === null) return [];
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
        if (!file.name.toLowerCase().endsWith('.zip') && !file.name.toLowerCase().endsWith('.xml')) {
            return NextResponse.json({ error: 'Invalid file type. Please upload a ZIP or XML file.' }, { status: 400 });
        }
        
        let filesProcessed = 0;
        const xmlContents: string[] = [];

        if (file.name.toLowerCase().endsWith('.zip')) {
            const fileBuffer = Buffer.from(await file.arrayBuffer());
            const zip = await jszip.loadAsync(fileBuffer);
            
            const xmlFiles = Object.keys(zip.files).filter(filename => 
                filename.toLowerCase().endsWith('.xml') && !zip.files[filename].dir
            );

            for (const filename of xmlFiles) {
                const content = await zip.files[filename].async('string');
                xmlContents.push(content);
                filesProcessed++;
            }
        } else { // It's an XML file
            const content = await file.text();
            xmlContents.push(content);
            filesProcessed = 1;
        }

        if (filesProcessed === 0) {
            return NextResponse.json({ error: 'No valid TransXchange XML files found in the upload.' }, { status: 400 });
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            removeNSPrefix: true,
            parseNodeValue: true,
            parseAttributeValue: true,
            trimValues: true,
        });
        
        // Aggregated data stores
        const allStopPoints: any[] = [];
        const journeyPatternsById: any = {};
        const journeyPatternSectionsById: any = {};
        const vehicleJourneysList: any[] = [];
        const serviceNames = new Set<string>();

        // STAGE 1: Aggregate all data from all files into memory
        for (const xmlContent of xmlContents) {
            const data = parser.parse(xmlContent)?.TransXChange;
            if (!data) continue;

            const stopPointsContainer = data.StopPoints || data.Stops;
            if (stopPointsContainer) {
                allStopPoints.push(...ensureArray(stopPointsContainer.AnnotatedStopPointRef));
                allStopPoints.push(...ensureArray(stopPointsContainer.StopPoint));
            }

            const sections = ensureArray(data.JourneyPatternSections?.JourneyPatternSection);
            for (const section of sections) {
                if (section.id && !journeyPatternSectionsById[section.id]) {
                    journeyPatternSectionsById[section.id] = section;
                }
            }
            
            const services = ensureArray(data.Services?.Service);
            for (const service of services) {
                const serviceName = getText(service.Lines?.Line?.LineName) ?? 'Unknown';
                serviceNames.add(serviceName);
                const patterns = ensureArray(service.StandardService?.JourneyPattern);
                for (const pattern of patterns) {
                    if (pattern.id && !journeyPatternsById[pattern.id]) {
                        pattern.serviceName = serviceName;
                        pattern.DestinationDisplay = getText(pattern.DestinationDisplay);
                        journeyPatternsById[pattern.id] = pattern;
                    }
                }
            }
            
            vehicleJourneysList.push(...ensureArray(data.VehicleJourneys?.VehicleJourney));
        }
        
        // STAGE 2: Process aggregated stop points to build coordinate map
        const stopPointsCoords: Record<string, { lat: number; lng: number }> = {};
        let stopPointsParsedCount = 0;
        for (const sp of allStopPoints) {
             const atcoCode = getText(sp.AtcoCode) ?? getText(sp.StopPointRef);
             const location = sp.Location ?? sp.Place?.Location;
             const latStr = location ? (getText(location.Latitude) ?? getText(location.latitude)) : undefined;
             const lngStr = location ? (getText(location.Longitude) ?? getText(location.longitude)) : undefined;

             if (atcoCode && latStr && lngStr) {
                const lat = parseFloat(latStr);
                const lng = parseFloat(lngStr);
                if (!isNaN(lat) && !isNaN(lng) && !stopPointsCoords[atcoCode]) {
                    stopPointsCoords[atcoCode] = { lat, lng };
                    stopPointsParsedCount++;
                }
            }
        }

        // STAGE 3: Process Journey Patterns to build routes
        const routeGeometry: any = {};
        const routeMetadata: any = {};
        for (const patternId in journeyPatternsById) {
            const pattern = journeyPatternsById[patternId];
            const routePath: {lat: number, lng: number}[] = [];
            
            let sectionRefs: string[] = [];
            const jpsRefs = pattern.JourneyPatternSectionRefs;
            if (typeof jpsRefs === 'string') {
                sectionRefs = jpsRefs.split(' ').filter(Boolean);
            } else if (jpsRefs && jpsRefs.JourneyPatternSectionRef) {
                sectionRefs = ensureArray(jpsRefs.JourneyPatternSectionRef).map(getText).filter(Boolean) as string[];
            }
            
            const sections = sectionRefs.map(refId => journeyPatternSectionsById[refId]).filter(Boolean);
            if (sections.length === 0) continue;

            let isFirstLinkOfPattern = true;
            for (const section of sections) {
                const timingLinks = ensureArray(section.JourneyPatternTimingLink);
                for (const link of timingLinks) {
                    if (isFirstLinkOfPattern) {
                        const fromStopRef = getText(link.From?.StopPointRef);
                        const fromCoords = fromStopRef ? stopPointsCoords[fromStopRef] : undefined;
                        if (fromCoords) routePath.push(fromCoords);
                        isFirstLinkOfPattern = false;
                    }

                    const toStopRef = getText(link.To?.StopPointRef);
                    const toCoords = toStopRef ? stopPointsCoords[toStopRef] : undefined;
                    if (toCoords) {
                         const lastPoint = routePath.length > 0 ? routePath[routePath.length - 1] : null;
                         if (!lastPoint || lastPoint.lat !== toCoords.lat || lastPoint.lng !== toCoords.lng) {
                            routePath.push(toCoords);
                         }
                    }
                }
            }

            if (routePath.length > 1) {
                routeGeometry[pattern.id] = routePath;
                routeMetadata[pattern.id] = {
                    name: `Service ${pattern.serviceName}: ${pattern.DestinationDisplay}`,
                    service: pattern.serviceName,
                    destination: pattern.DestinationDisplay,
                    direction: getText(pattern.Direction),
                    id: pattern.id,
                };
            }
        }
        
        // STAGE 4: Process Vehicle Journeys to build timetables
        const timetable: any = {};
        for (const vj of vehicleJourneysList) {
            const journeyRef = getText(vj.VehicleJourneyCode);
            const departureTimeStr = getText(vj.DepartureTime);
            const journeyPatternRef = getText(vj.JourneyPatternRef);

            if (!journeyRef || !departureTimeStr || !journeyPatternRef || !journeyPatternsById[journeyPatternRef]) continue;
            
            const pattern = journeyPatternsById[journeyPatternRef];
            const departureTime = dateFnsParse(departureTimeStr, 'HH:mm:ss', new Date(0));
            if (isNaN(departureTime.getTime())) continue;

            let currentTime = departureTime;
            const stopTimes: { stop: string; time: string }[] = [];
            
            let sectionRefs: string[] = [];
            const jpsRefs = pattern.JourneyPatternSectionRefs;
            if (typeof jpsRefs === 'string') {
                sectionRefs = jpsRefs.split(' ').filter(Boolean);
            } else if (jpsRefs && jpsRefs.JourneyPatternSectionRef) {
                sectionRefs = ensureArray(jpsRefs.JourneyPatternSectionRef).map(getText).filter(Boolean) as string[];
            }

            const sections = sectionRefs.map(refId => journeyPatternSectionsById[refId]).filter(Boolean);
            if (sections.length === 0) continue;

            let isFirstLinkOfJourney = true;
            for (const section of sections) {
                const timingLinks = ensureArray(section.JourneyPatternTimingLink);
                for (const link of timingLinks) {
                    if (isFirstLinkOfJourney) {
                        const fromStopRef = getText(link.From?.StopPointRef);
                        if (fromStopRef) stopTimes.push({ stop: fromStopRef, time: currentTime.toTimeString().split(' ')[0] });
                        isFirstLinkOfJourney = false;
                    }

                    const runTime = parseISO8601Duration(getText(link.RunTime));
                    currentTime = add(currentTime, runTime);
                    
                    const toStopRef = getText(link.To?.StopPointRef);
                    if (toStopRef) stopTimes.push({ stop: toStopRef, time: currentTime.toTimeString().split(' ')[0] });
                    
                    const waitTime = parseISO8601Duration(getText(link.To?.WaitTime));
                    currentTime = add(currentTime, waitTime);
                }
            }
            if(stopTimes.length > 0) {
              timetable[journeyRef] = stopTimes;
            }
        }

        // STAGE 5: Write processed data to files
        await fs.writeFile(path.join(process.cwd(), 'src', 'lib', 'timetable-data.json'), JSON.stringify(timetable, null, 2));
        await fs.writeFile(path.join(process.cwd(), 'src', 'lib', 'route-geometry.json'), JSON.stringify(routeGeometry, null, 2));
        await fs.writeFile(path.join(process.cwd(), 'src', 'lib', 'route-metadata.json'), JSON.stringify(routeMetadata, null, 2));

        // STAGE 6: Generate report
        const routesFound = Object.keys(routeMetadata).length;
        const timetablesFound = Object.keys(timetable).length;
        const serviceNameSample = Array.from(serviceNames).slice(0, 5).join(', ');
        
        let message = `Processed ${filesProcessed} file(s).\n\n`;
        message += `SERVICES: Found ${serviceNames.size} services (e.g., ${serviceNameSample}...).\n`;
        message += `TIMETABLES: Created timetable data for ${timetablesFound} unique journeys.\n`;
        message += `ROUTES: Successfully constructed ${routesFound} routes from ${Object.keys(journeyPatternsById).length} patterns.\n`;
        message += `STOP POINTS: Found coordinates for ${stopPointsParsedCount} unique stops out of ${allStopPoints.length} processed.\n\n`;
        message += `Upload successful. You can now select these routes on the map page.`;

        return NextResponse.json({ message }, { status: 200 });

    } catch (error: any) {
        console.error('TransXchange upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
