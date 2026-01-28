import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function TimetablePage() {
  const downloadUrl = "https://data.bus-data.dft.gov.uk/timetable/dataset/12769/download/";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Service Timetables</CardTitle>
            <CardDescription>
              Download official timetable data from the Bus Open Data Service (BODS).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              This page provides access to the full timetable dataset for Go North West services. The data is provided in the TransXChange format, a standard for exchanging bus schedules and related data.
            </p>
            <p className="text-muted-foreground">
              You can download the complete dataset as a ZIP file. Please note that you will need specialized software to view or process these files.
            </p>
          </CardContent>
          <CardFooter className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
             <Button asChild variant="outline">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
             </Button>
             <Button asChild>
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download Timetable Data
                </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
