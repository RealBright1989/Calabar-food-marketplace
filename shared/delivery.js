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

const ROUTE_CACHE_LIMIT = 80;
const routeCache = new Map();

/**
 * Free road-route fallback from OpenStreetMap's public OSRM demo server.
 * No API key is required. The result is cached so checkout and the gateway do
 * not repeat the same request during one payment flow.
 */
export async function fetchOsrmRoute(
  from,
  to,
  { withGeometry = false, timeoutMs = 7000 } = {},
) {
  if (!isValidPoint(from) || !isValidPoint(to)) return null;

  const key =
    `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>` +
    `${to.lat.toFixed(5)},${to.lng.toFixed(5)}|${withGeometry ? 1 : 0}`;
  if (routeCache.has(key)) return routeCache.get(key);

  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const overview = withGeometry ? 'simplified' : 'false';
  const geometries = withGeometry ? '&geometries=geojson' : '';
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    `?overview=${overview}&alternatives=false&steps=false${geometries}`;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const request = (async () => {
    try {
      const response = await fetch(url, {
        signal: controller?.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const payload = await response.json();
      const route = payload?.routes?.[0];
      if (payload?.code !== 'Ok' || !route) return null;
      if (typeof route.distance !== 'number' || typeof route.duration !== 'number') return null;

      const geometry = withGeometry && Array.isArray(route.geometry?.coordinates)
        ? route.geometry.coordinates
            .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
            .filter(isValidPoint)
        : undefined;

      return {
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        source: 'osm',
        ...(geometry ? { geometry } : {}),
      };
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  })();

  routeCache.set(key, request);
  if (routeCache.size > ROUTE_CACHE_LIMIT) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey !== undefined) routeCache.delete(oldestKey);
  }
  return request;
}

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
