'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Bus } from '@/lib/types';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Bus as BusIcon,
  Navigation,
  Clock,
  Route,
  Gauge,
  AlertTriangle,
  MapPin,
  ArrowUpDown,
  Hash,
  Clipboard,
  Moon,
  GraduationCap,
  Timer,
  Info,
  Mail,
  CircleDot,
  ArrowRight,
  Loader2,
  MapPinned,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const OPERATOR_NAMES: Record<string, string> = {
  GNW: 'Go North West',
  MET: 'Metroline',
  VB: 'Vision Bus',
  SC: 'Stagecoach',
  FB: 'First Bus',
  DB: 'Diamond Bus',
};

const OPERATOR_COLORS: Record<string, string> = {
  GNW: '#FFC107',
  MET: '#E91E63',
  VB: '#8BC34A',
  SC: '#FF5722',
  FB: '#3F51B5',
  DB: '#00BCD4',
};

const firstJourneyRefs = ['1001', '1002', '1301', '1302', '1601', '1602'];
const lastJourneyRefs = ['8001', '8002', '8301', '8302', '8601', '8602'];
const schoolJourneyRefs = ['9001', '9002', '9003', '9004', '9005'];
const nightBusRunningBoards = [
  '3691', '3692', '3693', '1091', '1092', '1093',
  '21091', '21092', '21093', '23691', '23692', '23693',
  '11091', '11092', '11093', '13691', '13692', '13693',
];

interface BusDetailPanelProps {
  bus: Bus | null;
  allBuses: Bus[];
  onClose: () => void;
  isOpen: boolean;
}

export default function BusDetailPanel({ bus, allBuses, onClose, isOpen }: BusDetailPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [postcode, setPostcode] = useState<string | null>(null);
  const [locality, setLocality] = useState<string | null>(null);
  const [postcodeLoading, setPostcodeLoading] = useState(false);

  // Reset collapsed state when a new bus is selected
  useEffect(() => {
    if (bus) setCollapsed(false);
  }, [bus]);

  // Reverse-geocode the bus position to get postcode
  useEffect(() => {
    if (!bus?.position) {
      setPostcode(null);
      setLocality(null);
      return;
    }

    let cancelled = false;
    const { lat, lng } = bus.position;

    setPostcodeLoading(true);
    fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setPostcode(data.postcode ?? null);
          setLocality(data.locality ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPostcode(null);
          setLocality(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPostcodeLoading(false);
      });

    return () => { cancelled = true; };
  }, [bus?.position?.lat, bus?.position?.lng]);

  const isFirstJourney = bus?.operator === 'GNW' && bus?.journeyRef && firstJourneyRefs.includes(bus.journeyRef);
  const isLastJourney = bus?.operator === 'GNW' && bus?.journeyRef && lastJourneyRefs.includes(bus.journeyRef);
  const isSchool = bus?.operator === 'GNW' && bus?.journeyRef && schoolJourneyRefs.includes(bus.journeyRef);
  const isNight = bus?.operator === 'GNW' && bus?.runningBoard && nightBusRunningBoards.includes(bus.runningBoard);

  // Find other buses on the same service
  const sameLine = useMemo(() => {
    if (!bus) return [];
    return allBuses.filter(
      (b) => b.service === bus.service && b.fleetNumber !== bus.fleetNumber
    );
  }, [bus, allBuses]);

  // Group by direction
  const inbound = useMemo(() => sameLine.filter((b) => b.direction?.toLowerCase() === 'inbound'), [sameLine]);
  const outbound = useMemo(() => sameLine.filter((b) => b.direction?.toLowerCase() === 'outbound'), [sameLine]);

  const delayColor = (delay?: number) => {
    if (delay === undefined) return 'text-muted-foreground';
    if (delay > 3) return 'text-red-500';
    if (delay > 0) return 'text-amber-500';
    if (delay < -1) return 'text-blue-500';
    return 'text-emerald-500';
  };

  const operatorColor = bus ? OPERATOR_COLORS[bus.operator] ?? '#6b7280' : '#6b7280';

  if (!isOpen || !bus) return null;

  return (
    <div
      className={cn(
        'absolute top-0 right-0 h-full z-[60] flex transition-all duration-300 ease-in-out pointer-events-auto',
        collapsed ? 'w-10' : 'w-[380px] max-w-[85vw]'
      )}
    >
      {/* Collapse / expand toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-12 w-6 self-center -ml-6 rounded-l-md bg-card border border-r-0 border-border flex items-center justify-center hover:bg-accent transition-colors shadow-lg"
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Panel body */}
      <div
        className={cn(
          'flex-1 bg-card/95 backdrop-blur-md border-l border-border shadow-2xl overflow-y-auto',
          collapsed && 'hidden'
        )}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-4 py-3 border-b border-border flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${operatorColor}22, transparent)` }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0"
            style={{ backgroundColor: operatorColor }}
          >
            {bus.fleetNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg leading-tight truncate">
              Service {bus.service}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {OPERATOR_NAMES[bus.operator] ?? bus.operator}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Destination banner */}
        <div className="px-4 py-3 bg-muted/40 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{bus.destination}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3 w-3 shrink-0" />
            <span className="capitalize">{bus.direction?.toLowerCase()}</span>
          </div>
          {(postcode || locality) && (
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              <MapPinned className="h-3 w-3 shrink-0 text-primary" />
              <span className="font-semibold">
                {[locality, postcode].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {postcodeLoading && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Locating…</span>
            </div>
          )}
        </div>

        {/* Badges row */}
        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-border">
          <Badge variant="secondary" className={cn('text-[10px]', delayColor(bus.delay))}>
            <Clock className="h-3 w-3 mr-1" /> {bus.status}
          </Badge>
          {isFirstJourney && (
            <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">
              <Timer className="h-3 w-3 mr-1" /> First
            </Badge>
          )}
          {isLastJourney && (
            <Badge variant="outline" className="text-[10px] border-red-500 text-red-600">
              <Timer className="h-3 w-3 mr-1" /> Last
            </Badge>
          )}
          {isSchool && (
            <Badge variant="outline" className="text-[10px] border-red-500 text-red-500">
              <GraduationCap className="h-3 w-3 mr-1" /> School
            </Badge>
          )}
          {isNight && (
            <Badge variant="outline" className="text-[10px] border-purple-500 text-purple-500">
              <Moon className="h-3 w-3 mr-1" /> Night
            </Badge>
          )}
        </div>

        {/* Journey progress — last stop ➜ next stop */}
        {(bus.lastStop || bus.nextStop || bus.origin) && (
          <div className="px-4 py-3 space-y-2.5 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Journey Progress</h3>

            {bus.origin && (
              <div className="flex items-start gap-2 text-xs">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <CircleDot className="h-3 w-3 text-emerald-500" />
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Origin</span>
                  <span className="font-semibold">{bus.origin}</span>
                </div>
              </div>
            )}

            {bus.lastStop && (
              <div className="flex items-start gap-2 text-xs">
                <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Last Stop Visited</span>
                  <span className="font-semibold">{bus.lastStop}</span>
                </div>
              </div>
            )}

            {bus.nextStop && (
              <div className="flex items-start gap-2 text-xs">
                <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowRight className="h-3 w-3 text-amber-500" />
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Next Stop</span>
                  <span className="font-semibold">{bus.nextStop}</span>
                  {bus.nextStopExpectedArrival && (
                    <span className="text-[9px] text-muted-foreground ml-1">
                      (ETA {new Date(bus.nextStopExpectedArrival).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  )}
                </div>
              </div>
            )}

            {bus.destination && (
              <div className="flex items-start gap-2 text-xs">
                <div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Navigation className="h-3 w-3 text-red-500" />
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Destination</span>
                  <span className="font-semibold">{bus.destination}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detail grid */}
        <div className="px-4 py-3 space-y-2 border-b border-border">
          <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Vehicle Details</h3>
          <div className="grid grid-cols-2 gap-2">
            <DetailItem icon={<Hash className="h-3.5 w-3.5" />} label="Fleet No." value={bus.fleetNumber} />
            <DetailItem icon={<Clipboard className="h-3.5 w-3.5" />} label="Running Board" value={bus.runningBoard} />
            <DetailItem icon={<Route className="h-3.5 w-3.5" />} label="Journey Ref" value={bus.journeyRef ?? '—'} />
            <DetailItem icon={<Gauge className="h-3.5 w-3.5" />} label="Bearing" value={bus.bearing !== undefined ? `${bus.bearing}°` : '—'} />
          </div>
        </div>

        {/* Position */}
        {bus.position && (
          <div className="px-4 py-3 space-y-2 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Position</h3>
            <div className="flex items-center gap-2 text-xs font-mono bg-muted/30 rounded-md px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{bus.position.lat.toFixed(5)}, {bus.position.lng.toFixed(5)}</span>
            </div>
          </div>
        )}

        {/* Delay info */}
        {bus.delay !== undefined && (
          <div className="px-4 py-3 space-y-2 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Punctuality</h3>
            <div className="flex items-center gap-3">
              <div className={cn('text-2xl font-black', delayColor(bus.delay))}>
                {bus.delay > 0 ? '+' : ''}{bus.delay}
              </div>
              <div className="text-xs text-muted-foreground">
                {bus.delay > 0 ? 'minutes late' : bus.delay < 0 ? 'minutes early' : 'on schedule'}
              </div>
            </div>
            {Math.abs(bus.delay) > 5 && (
              <div className="flex items-start gap-2 text-xs bg-destructive/10 text-destructive rounded-md px-3 py-2 mt-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Significant deviation from schedule detected.</span>
              </div>
            )}
          </div>
        )}

        {/* Other buses on same line */}
        {sameLine.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
              Other Vehicles on Service {bus.service}
            </h3>
            {inbound.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Inbound ({inbound.length})</p>
                <div className="flex flex-wrap gap-1">
                  {inbound.map((b) => (
                    <span key={b.fleetNumber} className="text-[10px] bg-muted rounded px-1.5 py-0.5 font-mono font-bold">
                      {b.fleetNumber}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {outbound.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Outbound ({outbound.length})</p>
                <div className="flex flex-wrap gap-1">
                  {outbound.map((b) => (
                    <span key={b.fleetNumber} className="text-[10px] bg-muted rounded px-1.5 py-0.5 font-mono font-bold">
                      {b.fleetNumber}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border mt-auto">
          <p className="text-[9px] text-muted-foreground text-center italic">
            Data from BODS (Bus Open Data Service) &middot; Updated every 5s
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 bg-muted/30 rounded-md px-2.5 py-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[9px] text-muted-foreground font-medium">{label}</div>
        <div className="text-xs font-bold truncate">{value}</div>
      </div>
    </div>
  );
}
