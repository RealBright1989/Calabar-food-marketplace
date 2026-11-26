import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, Navigation, Search } from 'lucide-react';
import {
  fetchOsrmRoute,
  isValidPoint,
  NEIGHBOURHOOD_CENTRES,
  pointForNeighbourhood,
  quoteDelivery,
} from '../../../shared/delivery.js';
import type { DeliveryQuote, DeliverySource } from '../../../shared/delivery';
import { GeoPoint } from '../../types/marketplace';
import {
  searchCalabarAddresses,
  AddressSuggestion,
  reverseGeocode,
} from '../../lib/osmGeocoder';
import { OsmMapView } from '../ui/OsmMapView';

type GoogleMaps = any;

export interface DeliveryLocationSelection {
  location: GeoPoint;
  formattedAddress: string;
  neighbourhood: string;
  distanceKm: number;
  durationMin: number;
  deliveryFee: number;
  source: DeliverySource;
}

interface DeliveryMapPickerProps {
  heading?: string;
  restaurantName: string;
  restaurantAddress: string;
  pickup?: GeoPoint | null;
  deliveryAddress: string;
  neighbourhood: string;
  deliveryLocation?: GeoPoint | null;
  baseFee: number;
  quote: DeliveryQuote | null;
  onSelect: (selection: DeliveryLocationSelection) => void;
  onAddressChange: (address: string) => void;
}

interface LoadedMapState {
  map: GoogleMaps;
  deliveryMarker: GoogleMaps;
  pickupMarker: GoogleMaps;
}

declare global {
  interface Window {
    google?: { maps?: GoogleMaps };
    __calabarGoogleMapsLoader?: Promise<GoogleMaps> | null;
    __calabarGoogleMapsReady?: () => void;
  }
}

const MAPS_PLACEHOLDER = 'MY_GOOGLE_MAPS_API_KEY';

export function deliverySourceLabel(source: DeliverySource | undefined): string {
  if (source === 'google') return 'Google route';
  if (source === 'osm') return 'OpenStreetMap route';
  return 'Area estimate';
}

function asLatLng(point: GeoPoint) {
  return { lat: point.lat, lng: point.lng };
}

function pointFromLatLng(value: GoogleMaps): GeoPoint | null {
  if (!value) return null;
  const lat = typeof value.lat === 'function' ? value.lat() : value.lat;
  const lng = typeof value.lng === 'function' ? value.lng() : value.lng;
  const point = { lat: Number(lat), lng: Number(lng) };
  return isValidPoint(point) ? point : null;
}

function loadGoogleMaps(apiKey: string): Promise<GoogleMaps> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Maps are only available in the browser.'));
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__calabarGoogleMapsLoader) return window.__calabarGoogleMapsLoader;

  window.__calabarGoogleMapsLoader = new Promise<GoogleMaps>((resolve, reject) => {
    const callbackName = '__calabarGoogleMapsReady';
    window[callbackName] = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps loaded without the Maps JavaScript API.'));
    };

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&libraries=places&v=weekly&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'));
    document.head.appendChild(script);
  }).catch((error) => {
    window.__calabarGoogleMapsLoader = null;
    throw error;
  });

  return window.__calabarGoogleMapsLoader;
}

function matchNeighbourhood(address: string): string | undefined {
  const lower = address.toLowerCase();
  const aliases: Record<string, string[]> = {
    'Marian Road': ['marian', 'ndidem usang iso'],
    'State Housing': ['state housing', 'leopard town', 'atekong'],
    'Parliamentary Extension': ['parliamentary', 'parliament'],
    'Calabar South': ['calabar south', 'marina road', 'waterfront'],
    'Diamond Hill': ['diamond hill', 'barracks road'],
    'Akai Effa': ['akai effa', 'mcc road'],
  };

  for (const area of Object.keys(NEIGHBOURHOOD_CENTRES)) {
    if ((aliases[area] || [area]).some((alias) => lower.includes(alias.toLowerCase()))) {
      return area;
    }
  }
  return undefined;
}

export const DeliveryMapPicker: React.FC<DeliveryMapPickerProps> = ({
  heading = 'Pickup & delivery map',
  restaurantName,
  restaurantAddress,
  pickup,
  deliveryAddress,
  neighbourhood,
  deliveryLocation,
  baseFee,
  quote,
  onSelect,
  onAddressChange,
}) => {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const mapsEnabled = Boolean(apiKey && apiKey !== MAPS_PLACEHOLDER);

  const resolvedPickup =
    pickup && isValidPoint(pickup)
      ? pickup
      : pointForNeighbourhood(neighbourhood) || pointForNeighbourhood('State Housing')!;

  const [mapElement, setMapElement] = useState<HTMLDivElement | null>(null);
  const [searchElement, setSearchElement] = useState<HTMLInputElement | null>(null);
  const [searchValue, setSearchValue] = useState(deliveryAddress);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    mapsEnabled ? 'loading' : 'ready',
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  const mapsRef = useRef<GoogleMaps | null>(null);
  const mapStateRef = useRef<LoadedMapState | null>(null);
  const pickupRef = useRef<GeoPoint>(resolvedPickup);
  const neighbourhoodRef = useRef(neighbourhood);
  const deliveryLocationRef = useRef<GeoPoint | null | undefined>(deliveryLocation);
  const deliveryLat = deliveryLocation?.lat ?? null;
  const deliveryLng = deliveryLocation?.lng ?? null;
  const configRef = useRef({ baseFee, neighbourhood, deliveryAddress, onSelect });

  pickupRef.current = resolvedPickup;
  neighbourhoodRef.current = neighbourhood;
  deliveryLocationRef.current = deliveryLocation;
  configRef.current = { baseFee, neighbourhood, deliveryAddress, onSelect };

  useEffect(() => {
    setSearchValue(deliveryAddress);
  }, [deliveryAddress]);

  useEffect(() => {
    if (!mapsEnabled) setStatus('ready');
  }, [mapsEnabled]);

  const emitLocation = useCallback(async (point: GeoPoint, preferredAddress?: string) => {
    if (!isValidPoint(point)) return;
    const maps = mapsRef.current;
    let formattedAddress = preferredAddress?.trim() || configRef.current.deliveryAddress;
    let resolvedNeighbourhood = configRef.current.neighbourhood;
    let routeSource: DeliverySource = 'estimated';
    let roadDistanceKm: number | undefined;
    let durationMin: number | undefined;

    if (maps) {
      try {
        const geocoder = new maps.Geocoder();
        const geocodeResult = await new Promise<GoogleMaps>((resolve) => {
          geocoder.geocode({ location: asLatLng(point) }, (results: GoogleMaps, resultStatus: string) => {
            if (resultStatus === 'OK' && Array.isArray(results) && results.length > 0) {
              resolve(results[0]);
            } else {
              resolve(null);
            }
          });
        });
        if (geocodeResult) {
          if (!preferredAddress && geocodeResult.formatted_address) {
            formattedAddress = String(geocodeResult.formatted_address);
          }
          resolvedNeighbourhood =
            matchNeighbourhood(String(geocodeResult.formatted_address || '')) ||
            resolvedNeighbourhood;
        }
      } catch {
        // Reverse geocoding is optional; the selected coordinates still stand.
      }

      try {
        const matrix = new maps.DistanceMatrixService();
        const googleRoute = await new Promise<GoogleMaps>((resolve) => {
          matrix.getDistanceMatrix(
            {
              origins: [asLatLng(pickupRef.current)],
              destinations: [asLatLng(point)],
              travelMode: maps.TravelMode.DRIVING,
              unitSystem: maps.UnitSystem.METRIC,
            },
            (response: GoogleMaps, responseStatus: string) => {
              if (responseStatus !== 'OK') {
                resolve(null);
                return;
              }
              const element = response?.rows?.[0]?.elements?.[0];
              if (!element || element.status !== 'OK' || !element.distance || !element.duration) {
                resolve(null);
                return;
              }
              resolve({
                distanceKm: element.distance.value / 1000,
                durationMin: element.duration.value / 60,
              });
            },
          );
        });
        if (googleRoute) {
          roadDistanceKm = googleRoute.distanceKm;
          durationMin = googleRoute.durationMin;
          routeSource = 'google';
        }
      } catch {
        // Distance Matrix is optional; other route sources are tried below.
      }
    } else {
      try {
        if (!preferredAddress) {
          const reverseAddress = await reverseGeocode(point);
          if (reverseAddress) {
            formattedAddress = reverseAddress;
            resolvedNeighbourhood = matchNeighbourhood(reverseAddress) || resolvedNeighbourhood;
          }
        }
      } catch {
        // Reverse geocoding is optional; the selected coordinates still stand.
      }
    }

    if (roadDistanceKm === undefined) {
      const osmRoute = await fetchOsrmRoute(pickupRef.current, point);
      if (osmRoute) {
        roadDistanceKm = osmRoute.distanceKm;
        durationMin = osmRoute.durationMin;
        routeSource = 'osm';
      }
    }

    const nextQuote = quoteDelivery({
      pickup: pickupRef.current,
      delivery: point,
      baseFee: configRef.current.baseFee,
      roadDistanceKm,
      durationMin,
      source: routeSource,
    });

    configRef.current.onSelect({
      location: point,
      formattedAddress,
      neighbourhood: resolvedNeighbourhood,
      distanceKm: nextQuote.distanceKm,
      durationMin: nextQuote.durationMin,
      deliveryFee: nextQuote.deliveryFee,
      source: nextQuote.source,
    });
  }, []);

  const moveGoogleMarker = useCallback((point: GeoPoint) => {
    const state = mapStateRef.current;
    if (!state || !mapsRef.current || !isValidPoint(point)) return;
    state.deliveryMarker.setPosition(asLatLng(point));
    const bounds = new mapsRef.current.LatLngBounds();
    bounds.extend(asLatLng(pickupRef.current));
    bounds.extend(asLatLng(point));
    state.map.fitBounds(bounds, 48);
  }, []);

  useEffect(() => {
    if (!mapsEnabled) return;
    if (!mapElement || !searchElement) return;

    let cancelled = false;
    const listeners: Array<{ remove: () => void }> = [];
    setStatus('loading');

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled) return;
        const startingPoint =
          deliveryLocationRef.current && isValidPoint(deliveryLocationRef.current)
            ? deliveryLocationRef.current
            : pointForNeighbourhood(neighbourhoodRef.current) || { lat: 4.95, lng: 8.32 };

        const map = new maps.Map(mapElement, {
          center: asLatLng(startingPoint),
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
          fullscreenControl: true,
        });

        const pickupMarker = new maps.Marker({
          position: asLatLng(pickupRef.current),
          map,
          title: `Pickup · ${restaurantName}`,
          label: 'R',
        });
        const deliveryMarker = new maps.Marker({
          position: asLatLng(startingPoint),
          map,
          title: 'Your delivery location',
          label: 'D',
          draggable: true,
        });

        const autocomplete = new maps.places.Autocomplete(searchElement, {
          fields: ['formatted_address', 'geometry', 'name'],
          bounds: new maps.LatLngBounds(
            { lat: 4.86, lng: 8.22 },
            { lat: 5.05, lng: 8.42 },
          ),
          componentRestrictions: { country: 'ng' },
        });

        listeners.push(
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const point = pointFromLatLng(place?.geometry?.location);
            if (!point) {
              setStatusMessage('Choose a place suggestion so we can pinpoint the delivery address.');
              return;
            }
            moveGoogleMarker(point);
            void emitLocation(point, place?.formatted_address || place?.name || undefined);
          }),
        );
        listeners.push(
          map.addListener('click', (event: GoogleMaps) => {
            const point = pointFromLatLng(event.latLng);
            if (point) {
              moveGoogleMarker(point);
              void emitLocation(point);
            }
          }),
        );
        listeners.push(
          deliveryMarker.addListener('dragend', () => {
            const point = pointFromLatLng(deliveryMarker.getPosition());
            if (point) void emitLocation(point);
          }),
        );

        mapsRef.current = maps;
        mapStateRef.current = { map, deliveryMarker, pickupMarker };
        setStatus('ready');
        setStatusMessage('');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus('unavailable');
        setStatusMessage(
          error instanceof Error
            ? `${error.message} OpenStreetMap fallback is unavailable while Google Maps is configured.`
            : 'Google Maps could not load.',
        );
      });

    return () => {
      cancelled = true;
      listeners.forEach((listener) => {
        try {
          listener.remove();
        } catch {
          // Ignore listener cleanup errors during hot reload.
        }
      });
      mapStateRef.current?.deliveryMarker.setMap(null);
      mapStateRef.current?.pickupMarker.setMap(null);
      mapStateRef.current = null;
      mapsRef.current = null;
    };
  }, [apiKey, mapsEnabled, mapElement, searchElement, restaurantName, emitLocation, moveGoogleMarker]);

  useEffect(() => {
    const state = mapStateRef.current;
    if (!state || deliveryLat === null || deliveryLng === null) return;
    const point = { lat: deliveryLat, lng: deliveryLng };
    if (!isValidPoint(point)) return;
    state.deliveryMarker.setPosition(asLatLng(point));
    state.map.panTo(asLatLng(point));
  }, [deliveryLat, deliveryLng]);

  const handleOsmSearch = async () => {
    const query = searchValue.trim();
    if (query.length < 3) {
      setStatusMessage('Type at least 3 characters to search an address.');
      return;
    }
    setSearching(true);
    setStatusMessage('Searching OpenStreetMap...');
    const results = await searchCalabarAddresses(query);
    setSuggestions(results);
    setSearching(false);
    setStatusMessage(
      results.length > 0
        ? 'Select a result to drop the pin, or click anywhere on the map.'
        : 'No matching address found. Click the map to place the pin manually.',
    );
  };

  const handleSuggestionPick = (suggestion: AddressSuggestion) => {
    setSearchValue(suggestion.label);
    setSuggestions([]);
    setStatusMessage('');
    moveGoogleMarker(suggestion.point);
    void emitLocation(suggestion.point, suggestion.label);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage('This browser does not support location detection.');
      return;
    }
    setStatusMessage('Finding your current location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        };
        if (!isValidPoint(point)) {
          setStatusMessage('We could not read your current location. Try the map instead.');
          return;
        }
        moveGoogleMarker(point);
        void emitLocation(point);
        setStatusMessage('Current location selected. Confirm the street address below.');
      },
      () => {
        setStatusMessage('Location access was declined. Search for your address or use the map.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const osmDeliveryPoint: GeoPoint =
    deliveryLocation && isValidPoint(deliveryLocation)
      ? deliveryLocation
      : pointForNeighbourhood(neighbourhood) || { lat: 4.95, lng: 8.32 };

  return (
    <div className="rounded-[12px] border border-[#E7E5E4] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E7E5E4] bg-[#FFF7ED]/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#EA580C] shrink-0" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-[#1C1917]">{heading}</span>
        </div>
        <span className="text-[12px] text-[#78716C]">
          {mapsEnabled ? 'Google Maps' : 'OpenStreetMap'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label
            htmlFor="delivery-map-search"
            className="block text-[13px] font-medium text-[#1C1917] mb-1.5"
          >
            Search delivery location
          </label>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]"
              aria-hidden="true"
            />
            <input
              id="delivery-map-search"
              ref={mapsEnabled ? setSearchElement : undefined}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                onAddressChange(e.target.value);
                if (!mapsEnabled) setSuggestions([]);
              }}
              onKeyDown={(e) => {
                if (!mapsEnabled && e.key === 'Enter') {
                  e.preventDefault();
                  void handleOsmSearch();
                }
              }}
              placeholder="Start typing an address in Calabar"
              className="w-full h-12 pl-10 pr-3.5 rounded-[8px] bg-white border border-[#E7E5E4] focus:border-[#EA580C] focus:outline-none text-[15px] text-[#1C1917] placeholder:text-[#78716C]/80"
            />
            {!mapsEnabled && (
              <button
                type="button"
                onClick={() => void handleOsmSearch()}
                disabled={searching}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 h-9 rounded-[7px] bg-[#EA580C] text-white text-[13px] font-semibold hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
              >
                {searching ? 'Searching' : 'Search'}
              </button>
            )}
          </div>
        </div>

        {!mapsEnabled && suggestions.length > 0 && (
          <div className="rounded-[8px] border border-[#E7E5E4] bg-white overflow-hidden">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSuggestionPick(suggestion)}
                className="w-full text-left px-3.5 py-2.5 border-b last:border-b-0 border-[#E7E5E4] hover:bg-[#FFF7ED] cursor-pointer"
              >
                <span className="block text-[13px] text-[#1C1917] line-clamp-2">
                  {suggestion.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {mapsEnabled ? (
          <div className="relative w-full h-[280px] rounded-[8px] border border-[#E7E5E4] bg-[#F5F5F4] overflow-hidden">
            <div ref={setMapElement} className="w-full h-full" />
            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F4]/80 text-[13px] text-[#78716C]">
                Loading delivery map...
              </div>
            )}
            {status === 'unavailable' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#FFF7ED]/90 text-[13px] text-[#78716C] p-5 text-center">
                Map provider unavailable. You can still enter your neighbourhood and street address.
              </div>
            )}
          </div>
        ) : (
          <OsmMapView
            pickup={resolvedPickup}
            delivery={osmDeliveryPoint}
            restaurantName={restaurantName}
            onLocationSelect={(point) => {
              setSuggestions([]);
              void emitLocation(point);
            }}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#EA580C] hover:text-[#C2410C] cursor-pointer"
          >
            <LocateFixed className="w-4 h-4" aria-hidden="true" />
            Use my current location
          </button>
          {quote && (
            <div className="text-[12px] text-[#78716C]">
              <span className="font-semibold text-[#1C1917]">{quote.distanceKm} km</span> ·{' '}
              {quote.durationMin} mins · {deliverySourceLabel(quote.source)}
            </div>
          )}
        </div>

        {statusMessage && <p className="text-[12px] text-[#78716C]">{statusMessage}</p>}
        {status === 'ready' && !statusMessage && (
          <p className="text-[12px] text-[#78716C]">
            Drag the green marker, click the map, or search an address to set the exact drop-off
            point.
          </p>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#E7E5E4] text-[13px]">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-6 h-6 rounded-full bg-[#EA580C] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
            R
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[#1C1917] truncate">Pickup · {restaurantName}</p>
            <p className="text-[#78716C] truncate">{restaurantAddress}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-6 h-6 rounded-full bg-[#15803D] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
            D
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[#1C1917] truncate">Drop-off · {neighbourhood}</p>
            <p className="text-[#78716C] truncate">
              {deliveryAddress.trim() || 'Search or enter your street address'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
