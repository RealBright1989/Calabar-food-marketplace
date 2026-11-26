import { isValidPoint, pointForNeighbourhood } from '../../shared/delivery.js';
import { GeoPoint } from '../types/marketplace';

export interface AddressSuggestion {
  id: string;
  label: string;
  point: GeoPoint;
}

interface NominatimSearchItem {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
}

interface NominatimReverseResult {
  display_name?: string;
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const CALABAR_VIEWBOX = '8.20,5.05,8.44,4.84';

function parsePoint(lat: unknown, lng: unknown): GeoPoint | null {
  const point = { lat: Number(lat), lng: Number(lng) };
  return isValidPoint(point) ? point : null;
}

export async function searchCalabarAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    q: trimmed,
    countrycodes: 'ng',
    bounded: '1',
    viewbox: CALABAR_VIEWBOX,
    limit: '5',
  });

  try {
    const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const results = (await response.json()) as NominatimSearchItem[];
    return results
      .map((item) => {
        const point = parsePoint(item.lat, item.lon);
        if (!point || !item.display_name) return null;
        return {
          id: String(item.place_id ?? `${point.lat},${point.lng}`),
          label: item.display_name,
          point,
        };
      })
      .filter((item): item is AddressSuggestion => item !== null);
  } catch {
    return [];
  }
}

export async function reverseGeocode(point: GeoPoint, signal?: AbortSignal): Promise<string | null> {
  if (!isValidPoint(point)) return null;
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.lat),
    lon: String(point.lng),
    zoom: '18',
    addressdetails: '1',
  });

  try {
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const result = (await response.json()) as NominatimReverseResult;
    return result.display_name || null;
  } catch {
    return null;
  }
}

export function fallbackPointForAddress(neighbourhood: string): GeoPoint {
  return pointForNeighbourhood(neighbourhood) || { lat: 4.95, lng: 8.32 };
}
