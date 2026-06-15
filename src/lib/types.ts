export type Pair = [string, number];

export interface Summary {
  totalViolations: number;
  geoViolations: number;
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
