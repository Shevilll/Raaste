export type Pair = [string, number];

export interface Summary {
  totalViolations: number;
  geoViolations: number;
  totalImpact: number;
  dateRange: [string, string];
  cityCenter: [number, number];
  numHotspots: number;
  sampleSize: number;
  violationTypes: Pair[];
  vehicleTypes: Pair[];
  topStations: [string, number, number][];
  hourly: number[];
  daily: number[];
  hourDow: number[][];
  monthly: [string, number][];
  typeLegend: string[];
  vehicleLegend: string[];
}

export interface Hotspot {
  id: string;
  rank: number;
  lat: number;
  lng: number;
  count: number;
  impact: number;
  score: number;
  topTypes: [string, number][];
  vehicle: string;
  station: string;
  location: string;
  peakHour: number | null;
  peakDow: number | null;
  hourly: number[];
  daily: number[];
}

// points.json rows: [lat, lng, typeIdx, vehIdx, hour, dow]
export type Point = [number, number, number, number, number, number];

export interface PointsFile {
  points: Point[];
}

// congestion.json events: [lat, lng, causeIdx, priIdx]
export type CongestionEvent = [number, number, number, number];

export interface CongestionCost {
  topN: number;
  totalEventHours: number;
  medianMin: number;
  imputedSharePct: number;
  closureWeight: number;
  highPriWeight: number;
  nearEvents: number;
  nearHours: number;
  nearWeightedHours: number;
  pctHoursNear: number;
  estVehicleHours: number;
  estCostCrore: number;
  vehPerHour: number;
  rupeesPerVehHour: number;
}

export interface Congestion {
  events: CongestionEvent[];
  causeLegend: string[];
  nearby: Record<string, number>;
  minDistM: Record<string, number>;
  correlation: {
    radiusM: number;
    totalEvents: number;
    pctTop50: number;
    hitTop50: number;
    pctTop100: number;
    hitTop100: number;
    nHotspots: number;
  };
  cost: CongestionCost;
}

export interface Prediction {
  model: string;
  target: string;
  metrics: { r2: number; mae: number; nTrain: number; nTest: number };
  importances: [string, number][];
  forecast: Record<string, number[]>;
  sample: { station: string; actual: number[]; predicted: number[] };
}

export interface Offenders {
  totalVehicles: number;
  totalViolations: number;
  repeatOffenders: number;
  top1pct: { vehicles: number; share: number };
  offenders: { vehicle: string; count: number; type: string }[];
}

export interface Junction {
  id: string;
  code: string | null;
  name: string;
  rank: number;
  lat: number;
  lng: number;
  count: number;
  impact: number;
  score: number;
  topTypes: [string, number][];
  vehicle: string;
  station: string;
  peakHour: number | null;
  peakDow: number | null;
  hourly: number[];
  daily: number[];
  congestionNearby: number;
  minDistM: number | null;
}

export interface JunctionsFile {
  junctions: Junction[];
  count: number;
  violationsAtJunctions: number;
  pctOfViolations: number;
  impactAtJunctions: number;
  pctOfImpact: number;
  radiusM: number;
}

export interface Simulator {
  nMax: number;
  radiusM: number;
  totalImpact: number;
  totalCongestionHours: number;
  totalCongestionEvents: number;
  impactPct: number[];
  congHours: number[];
  congPct: number[];
  events: number[];
}

export interface Fines {
  totalViolations: number;
  totalPotentialCrore: number;
  realizedCrore: number;
  avgFine: number;
  validation: [string, number, number][];
  reviewed: number;
  rejectedPct: number;
  pendingPct: number;
  byStation: [string, number, number][];
  fineSchedule: [string, number][];
}
