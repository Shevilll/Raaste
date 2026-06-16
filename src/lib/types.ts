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
}

export interface Prediction {
  model: string;
  target: string;
  metrics: { r2: number; mae: number; nTrain: number; nTest: number };
  importances: [string, number][];
  sample: { station: string; actual: number[]; predicted: number[] };
}
