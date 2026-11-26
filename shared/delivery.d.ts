export type DeliverySource = 'google' | 'osm' | 'estimated';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeliveryQuote {
  distanceKm: number;
  durationMin: number;
  deliveryFee: number;
  straightKm: number;
  source: DeliverySource;
}

export interface DeliveryRouteResult {
  distanceKm: number;
  durationMin: number;
  source: 'osm';
  geometry?: GeoPoint[];
}

export const NEIGHBOURHOOD_CENTRES: Record<string, GeoPoint>;
export const FREE_RADIUS_KM: number;
export const FEE_PER_EXTRA_KM: number;
export const MAX_DELIVERY_FEE: number;
export const ROAD_FACTOR: number;

export function isValidPoint(point: unknown): point is GeoPoint;
export function haversineKm(from: GeoPoint, to: GeoPoint): number;
export function estimateRoadKm(from: GeoPoint, to: GeoPoint): number;
export function calculateDeliveryFee(baseFee: number, distanceKm: number): number;
export function fetchOsrmRoute(
  from: GeoPoint,
  to: GeoPoint,
  options?: { withGeometry?: boolean; timeoutMs?: number },
): Promise<DeliveryRouteResult | null>;
export function quoteDelivery(options: {
  pickup: GeoPoint | null | undefined;
  delivery: GeoPoint | null | undefined;
  baseFee: number;
  roadDistanceKm?: number | null;
  durationMin?: number | null;
  source?: DeliverySource;
}): DeliveryQuote;
export function pointForNeighbourhood(neighbourhood: string): GeoPoint | null;
