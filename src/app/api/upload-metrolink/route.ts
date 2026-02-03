import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
        }
        if (!file.name.toLowerCase().endsWith('.json')) {
            return NextResponse.json({ error: 'Invalid file type. Please upload a JSON file.' }, { status: 400 });
        }

        const fileContent = await file.text();
        try {
            const data = JSON.parse(fileContent);
            if (!Array.isArray(data.stops) || !Array.isArray(data.lines)) {
                throw new Error('Invalid JSON structure. Must contain "stops" and "lines" arrays.');
            }
        } catch (e: any) {
             return NextResponse.json({ error: `Invalid JSON file: ${e.message}` }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src', 'lib', 'metrolink-data.json');
        await fs.writeFile(filePath, fileContent, 'utf-8');

        return NextResponse.json({ message: `Successfully processed Metrolink data.` }, { status: 200 });

    } catch (error: any) {
        console.error('Metrolink upload error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
