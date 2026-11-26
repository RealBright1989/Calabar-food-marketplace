import React, { useEffect, useMemo, useState } from 'react';
import { Navigation } from 'lucide-react';
import { isValidPoint, pointForNeighbourhood } from '../../../shared/delivery.js';
import { GeoPoint } from '../../types/marketplace';
import { OsmMapView } from './OsmMapView';

interface DeliveryStaticMapProps {
  restaurantName: string;
  restaurantAddress: string;
  deliveryAddress: string;
  neighbourhood: string;
  pickupLocation?: GeoPoint | null;
  deliveryLocation?: GeoPoint | null;
  heading?: string;
}

function pointText(point: GeoPoint | null | undefined): string | null {
  return point && isValidPoint(point) ? `${point.lat},${point.lng}` : null;
}

export const DeliveryStaticMap: React.FC<DeliveryStaticMapProps> = ({
  restaurantName,
  restaurantAddress,
  deliveryAddress,
  neighbourhood,
  pickupLocation,
  deliveryLocation,
  heading = 'Route overview',
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const googleMapsEnabled = Boolean(apiKey && apiKey !== 'MY_GOOGLE_MAPS_API_KEY');

  const destinationDisplay = deliveryAddress.trim()
    ? `${deliveryAddress.trim()}, ${neighbourhood}, Calabar`
    : `${neighbourhood}, Calabar`;

  const [debouncedDest, setDebouncedDest] = useState(destinationDisplay);
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDest(destinationDisplay);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [destinationDisplay]);

  const staticMapUrl = useMemo(() => {
    if (!googleMapsEnabled || !apiKey) return null;

    const originLocation =
      pointText(pickupLocation) || `${restaurantAddress}, Calabar, Cross River, Nigeria`;
    const destLocation =
      pointText(deliveryLocation) || `${debouncedDest}, Cross River, Nigeria`;

    const params = new URLSearchParams({
      size: '640x320',
      scale: '2',
      format: 'png',
      maptype: 'roadmap',
      key: apiKey,
      solution_id: 'gmp_mcp_codeassist_v1_aistudio',
    });

    params.append('markers', `size:mid|color:0xEA580C|label:R|${originLocation}`);
    params.append('markers', `size:mid|color:0x15803D|label:D|${destLocation}`);
    params.append(
      'path',
      `color:0xEA580CCC|weight:4|geodesic:true|${originLocation}|${destLocation}`,
    );

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }, [apiKey, googleMapsEnabled, restaurantAddress, debouncedDest, pickupLocation, deliveryLocation]);

  useEffect(() => {
    if (staticMapUrl) setImageStatus('loading');
  }, [staticMapUrl]);

  const resolvedPickup: GeoPoint =
    pickupLocation && isValidPoint(pickupLocation)
      ? pickupLocation
      : pointForNeighbourhood('Marian Road') || { lat: 4.95, lng: 8.32 };
  const resolvedDelivery: GeoPoint =
    deliveryLocation && isValidPoint(deliveryLocation)
      ? deliveryLocation
      : pointForNeighbourhood(neighbourhood) || { lat: 4.95, lng: 8.32 };
  const showOsmMap = !staticMapUrl || imageStatus === 'error';

  return (
    <div className="rounded-[12px] border border-[#E7E5E4] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E7E5E4] bg-[#FFF7ED]/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#EA580C] shrink-0" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-[#1C1917]">{heading}</span>
        </div>
        <span className="text-[12px] text-[#78716C]">Calabar delivery zone</span>
      </div>

      {/* Static Google image when configured; otherwise a live OpenStreetMap view. */}
      <div className="relative w-full aspect-[2/1] bg-[#F5F5F4] overflow-hidden">
        {showOsmMap ? (
          <OsmMapView
            pickup={resolvedPickup}
            delivery={resolvedDelivery}
            restaurantName={restaurantName}
            className="w-full h-full rounded-none border-0"
            interactive={false}
          />
        ) : (
          <>
            {imageStatus === 'loading' && (
              <div
                className="absolute inset-0 bg-[#F5F5F4] animate-pulse flex items-center justify-center text-[13px] text-[#78716C]"
                aria-hidden="true"
              >
                Loading map preview...
              </div>
            )}
            <img
              src={staticMapUrl!}
              alt={`Map showing pickup at ${restaurantName} (${restaurantAddress}) and delivery to ${debouncedDest}`}
              width={640}
              height={320}
              onLoad={() => setImageStatus('loaded')}
              onError={() => setImageStatus('error')}
              className="w-full h-full object-contain block"
            />
          </>
        )}
      </div>

      {/* Pickup & Drop-off Legend */}
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
              {deliveryAddress.trim() || 'Enter street address above'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
