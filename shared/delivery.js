/**
 * Shared delivery-distance helpers used by both the browser checkout and the
 * Paystack gateway. Plain JS keeps this module importable from Vite and Node.
 */

export const NEIGHBOURHOOD_CENTRES = {
  'Marian Road': { lat: 4.9485, lng: 8.326 },
  'State Housing': { lat: 4.9375, lng: 8.33 },
  'Parliamentary Extension': { lat: 4.96, lng: 8.337 },
  'Calabar South': { lat: 4.94, lng: 8.315 },
  'Diamond Hill': { lat: 4.97, lng: 8.325 },
  'Akai Effa': { lat: 4.955, lng: 8.31 },
};

export const FREE_RADIUS_KM = 2;
export const FEE_PER_EXTRA_KM = 150;
export const MAX_DELIVERY_FEE = 3000;
export const ROAD_FACTOR = 1.3;

export function isValidPoint(point) {
  if (!point || typeof point !== 'object') return false;
  const { lat, lng } = point;
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

export function haversineKm(from, to) {
  if (!isValidPoint(from) || !isValidPoint(to)) return 0;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateRoadKm(from, to) {
  return haversineKm(from, to) * ROAD_FACTOR;
}

export function calculateDeliveryFee(baseFee, distanceKm) {
  const base = Number.isFinite(baseFee) && baseFee >= 0 ? Math.round(baseFee) : 850;
  const extraKm = Math.max(0, Math.ceil(distanceKm - FREE_RADIUS_KM));
  return Math.min(MAX_DELIVERY_FEE, base + extraKm * FEE_PER_EXTRA_KM);
}

export function quoteDelivery({
  pickup,
  delivery,
  baseFee,
  roadDistanceKm,
  durationMin,
  source = 'estimated',
}) {
  const straightKm = haversineKm(pickup, delivery);
  const distanceKm =
    typeof roadDistanceKm === 'number' && Number.isFinite(roadDistanceKm) && roadDistanceKm >= 0
      ? roadDistanceKm
      : estimateRoadKm(pickup, delivery);
  const estimatedDuration = Math.max(8, Math.round(distanceKm * 4));

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin:
      typeof durationMin === 'number' && Number.isFinite(durationMin) && durationMin > 0
        ? Math.round(durationMin)
        : estimatedDuration,
    deliveryFee: calculateDeliveryFee(baseFee, distanceKm),
    straightKm: Math.round(straightKm * 10) / 10,
    source,
  };
}

export function pointForNeighbourhood(neighbourhood) {
  return NEIGHBOURHOOD_CENTRES[neighbourhood] || null;
}
