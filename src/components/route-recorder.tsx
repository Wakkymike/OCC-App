'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Play, StopCircle, Loader2 } from 'lucide-react';

interface RouteRecorderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecording: (service: string) => void;
  onStopRecording: () => void;
  onExport: () => void;
  isRecording: boolean;
  recordedPointsCount: number;
  recordingService: string | null;
}

export default function RouteRecorderDialog({
  isOpen,
  onClose,
  onStartRecording,
  onStopRecording,
  onExport,
  isRecording,
  recordedPointsCount,
  recordingService
}: RouteRecorderDialogProps) {
  const [service, setService] = useState('582');

  const handleStart = () => {
    onStartRecording(service);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Route Recorder</DialogTitle>
          <DialogDescription>
            Record the path of a bus service to visualize its route.
            The recording will begin when a bus on the specified service starts its journey.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="service-number" className="text-right">
              Service
            </Label>
            <Input
              id="service-number"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="col-span-3"
              disabled={isRecording}
            />
          </div>
          {isRecording && (
             <div className="flex items-center justify-center p-4 bg-secondary rounded-md">
                <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                <div className="text-center">
                    <p className="font-semibold">Recording service {recordingService}...</p>
                    <p className="text-sm text-muted-foreground">{recordedPointsCount} points captured.</p>
                </div>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={onExport} disabled={isRecording}>
                <Download className="mr-2 h-4 w-4" />
                Export Selected Route
            </Button>
            <div>
                {isRecording ? (
                    <Button variant="destructive" onClick={onStopRecording}>
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop Recording
                    </Button>
                ) : (
                    <Button onClick={handleStart}>
                        <Play className="mr-2 h-4 w-4" />
                        Start Recording
                    </Button>
                )}
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
