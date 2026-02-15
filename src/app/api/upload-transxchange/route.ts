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
const parseISO8601Duration = (duration: string | undefined): Duration => {
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
        const timetable: any = {};
        const routeGeometry: any = {};
        const routeMetadata: any = {};
        const journeyPatternsById: any = {};
        const journeyPatternSectionsById: any = {};
        const stopPointsCoords: Record<string, { lat: number; lng: number }> = {};
        const vehicleJourneysList: any[] = [];
        
        const stats = {
            stopPoints: 0,
            services: new Set<string>(),
            journeyPatterns: 0,
            vehicleJourneys: 0
        };

        // STAGE 1: Aggregate all data from all files into memory
        for (const xmlContent of xmlContents) {
            const data = parser.parse(xmlContent)?.TransXChange;
            if (!data) continue;

            // Aggregate StopPoints
            const stopPoints = ensureArray(data.StopPoints?.StopPoint);
            for (const sp of stopPoints) {
                const atcoCode = getText(sp.AtcoCode);
                const latStr = getText(sp.Place?.Location?.Latitude);
                const lngStr = getText(sp.Place?.Location?.Longitude);
                if (atcoCode && latStr && lngStr) {
                    const lat = parseFloat(latStr);
                    const lng = parseFloat(lngStr);
                    if (!isNaN(lat) && !isNaN(lng) && !stopPointsCoords[atcoCode]) {
                        stopPointsCoords[atcoCode] = { lat, lng };
                    }
                }
            }

            // Aggregate JourneyPatternSections
            const sections = ensureArray(data.JourneyPatternSections?.JourneyPatternSection);
            for (const section of sections) {
                if (section.id && !journeyPatternSectionsById[section.id]) {
                    journeyPatternSectionsById[section.id] = section;
                }
            }
            
            // Aggregate Services and JourneyPatterns
            const services = ensureArray(data.Services?.Service);
            for (const service of services) {
                const serviceName = getText(service.Lines?.Line?.LineName) ?? 'Unknown';
                stats.services.add(serviceName);

                const patterns = ensureArray(service.StandardService?.JourneyPattern);
                for (const pattern of patterns) {
                    if (pattern.id && !journeyPatternsById[pattern.id]) {
                        pattern.serviceName = serviceName;
                        journeyPatternsById[pattern.id] = pattern;
                    }
                }
            }
            
            // Aggregate VehicleJourneys
            const vehicleJourneys = ensureArray(data.VehicleJourneys?.VehicleJourney);
            vehicleJourneysList.push(...vehicleJourneys);
        }
        
        stats.stopPoints = Object.keys(stopPointsCoords).length;
        stats.vehicleJourneys = vehicleJourneysList.length;


        // STAGE 2.1: Process aggregated VehicleJourneys to build Timetable
        for (const vj of vehicleJourneysList) {
            const journeyRef = getText(vj.VehicleJourneyCode);
            const departureTimeStr = getText(vj.DepartureTime);
            const journeyPatternRef = getText(vj.JourneyPatternRef);

            if (!journeyRef || !departureTimeStr || !journeyPatternRef || !journeyPatternsById[journeyPatternRef]) {
                continue;
            }

            const pattern = journeyPatternsById[journeyPatternRef];
            const departureTime = dateFnsParse(departureTimeStr, 'HH:mm:ss', new Date(0));
            if (isNaN(departureTime.getTime())) continue;

            let currentTime = departureTime;
            const stopTimes: { stop: string; time: string }[] = [];
            
            let sections: any[] = [];
            // Robustly find section references
            if (pattern.JourneyPatternSectionRefs?.JourneyPatternSectionRef) {
                const refs = ensureArray(pattern.JourneyPatternSectionRefs.JourneyPatternSectionRef);
                sections = refs.map(refId => journeyPatternSectionsById[refId]).filter(Boolean);
            } 
            // Fallback for inline sections if no refs are found
            else if (pattern.JourneyPatternSection) {
                sections = ensureArray(pattern.JourneyPatternSection);
            }

            let isFirstLinkOfJourney = true;
            for (const section of sections) {
                const timingLinks = ensureArray(section.JourneyPatternTimingLink);
                for (const link of timingLinks) {
                    const fromStopRef = getText(link.From?.StopPointRef);
                    if (isFirstLinkOfJourney && fromStopRef) {
                        stopTimes.push({ stop: fromStopRef, time: currentTime.toTimeString().split(' ')[0] });
                        isFirstLinkOfJourney = false;
                    }

                    const runTime = parseISO8601Duration(getText(link.RunTime));
                    const arrivalAtTo = add(currentTime, runTime);
                    
                    const toStopRef = getText(link.To?.StopPointRef);
                    if (toStopRef) {
                        stopTimes.push({ stop: toStopRef, time: arrivalAtTo.toTimeString().split(' ')[0] });
                    }

                    const waitTime = link.To?.WaitTime ? parseISO8601Duration(getText(link.To.WaitTime)) : {};
                    currentTime = add(arrivalAtTo, waitTime);
                }
            }
            if(stopTimes.length > 0) {
              timetable[journeyRef] = stopTimes;
            }
        }


        // STAGE 2.2: Process aggregated JourneyPatterns to build Routes
        for (const patternId in journeyPatternsById) {
            const pattern = journeyPatternsById[patternId];
            stats.journeyPatterns++;
            
            const routePath: {lat: number, lng: number}[] = [];
            let sections: any[] = [];
            
            // Robustly find section references
            if (pattern.JourneyPatternSectionRefs?.JourneyPatternSectionRef) {
                const refs = ensureArray(pattern.JourneyPatternSectionRefs.JourneyPatternSectionRef);
                sections = refs.map(refId => journeyPatternSectionsById[refId]).filter(Boolean);
            }
            // Fallback for inline sections
            else if (pattern.JourneyPatternSection) {
                sections = ensureArray(pattern.JourneyPatternSection);
            }

            if (sections.length === 0) continue;

            let isFirstLinkOfPattern = true;
            for (const section of sections) {
                const timingLinks = ensureArray(section.JourneyPatternTimingLink);
                for (const link of timingLinks) {
                    const fromStopRef = getText(link.From?.StopPointRef);
                    if (isFirstLinkOfPattern && fromStopRef && stopPointsCoords[fromStopRef]) {
                        routePath.push(stopPointsCoords[fromStopRef]);
                    }
                    isFirstLinkOfPattern = false;
                    
                    const toStopRef = getText(link.To?.StopPointRef);
                    if (toStopRef && stopPointsCoords[toStopRef]) {
                        routePath.push(stopPointsCoords[toStopRef]);
                    }
                }
            }

            if (routePath.length > 1) {
                routeGeometry[pattern.id] = routePath;
                routeMetadata[pattern.id] = {
                    name: `Service ${pattern.serviceName}: ${pattern.DestinationDisplay}`,
                    service: pattern.serviceName,
                    destination: pattern.DestinationDisplay,
                    direction: pattern.Direction,
                    id: pattern.id,
                };
            }
        }

        // STAGE 3: Write processed data to files
        const timetableFilePath = path.join(process.cwd(), 'src', 'lib', 'timetable-data.json');
        await fs.writeFile(timetableFilePath, JSON.stringify(timetable, null, 2));

        const routeGeometryFilePath = path.join(process.cwd(), 'src', 'lib', 'route-geometry.json');
        await fs.writeFile(routeGeometryFilePath, JSON.stringify(routeGeometry, null, 2));
        
        const routeMetadataFilePath = path.join(process.cwd(), 'src', 'lib', 'route-metadata.json');
        await fs.writeFile(routeMetadataFilePath, JSON.stringify(routeMetadata, null, 2));

        const routesFound = Object.keys(routeMetadata).length;
        const timetablesFound = Object.keys(timetable).length;
        const serviceNames = Array.from(stats.services).slice(0, 5).join(', ');

        const message = `Processed ${filesProcessed} file(s). Found ${stats.services.size} services (${serviceNames}...). Constructed ${routesFound} routes from ${stats.journeyPatterns} patterns. Timetable created for ${timetablesFound} journeys.`;
        return NextResponse.json({ message }, { status: 200 });

    } catch (error: any) {
        console.error('TransXchange upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
