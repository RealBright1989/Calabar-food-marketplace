import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface DeliveryStaticMapProps {
  restaurantName: string;
  restaurantAddress: string;
  deliveryAddress: string;
  neighbourhood: string;
  heading?: string;
}

export const DeliveryStaticMap: React.FC<DeliveryStaticMapProps> = ({
  restaurantName,
  restaurantAddress,
  deliveryAddress,
  neighbourhood,
  heading = 'Route overview',
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

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
    if (!apiKey || apiKey === 'MY_GOOGLE_MAPS_API_KEY') return null;

    const originLocation = `${restaurantAddress}, Calabar, Cross River, Nigeria`;
    const destLocation = `${debouncedDest}, Cross River, Nigeria`;

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
  }, [apiKey, restaurantAddress, debouncedDest]);

  useEffect(() => {
    if (staticMapUrl) {
      setImageStatus('loading');
    }
  }, [staticMapUrl]);

  return (
    <div className="rounded-[12px] border border-[#E7E5E4] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E7E5E4] bg-[#FFF7ED]/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#EA580C] shrink-0" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-[#1C1917]">{heading}</span>
        </div>
        <span className="text-[12px] text-[#78716C]">Calabar delivery zone</span>
      </div>

      {/* Static Map Image Frame (2:1 aspect ratio matches 640x320 so attribution is never cropped) */}
      <div className="relative w-full aspect-[2/1] bg-[#F5F5F4] overflow-hidden">
        {staticMapUrl && imageStatus !== 'error' ? (
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
              src={staticMapUrl}
              alt={`Static map showing pickup at ${restaurantName} (${restaurantAddress}) and delivery to ${debouncedDest}`}
              width={640}
              height={320}
              onLoad={() => setImageStatus('loaded')}
              onError={() => setImageStatus('error')}
              className="w-full h-full object-contain block"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center bg-[#FFF7ED]/60">
            <MapPin className="w-6 h-6 text-[#EA580C] mb-2" aria-hidden="true" />
            <p className="text-[14px] font-semibold text-[#1C1917]">
              Map preview unavailable right now
            </p>
            <p className="text-[13px] text-[#78716C] mt-1 max-w-sm">
              {!staticMapUrl
                ? 'Configure your Google Maps API key to display the static route map.'
                : 'Unable to load the static map image. Check your network connection or API key restrictions.'}
            </p>
          </div>
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
