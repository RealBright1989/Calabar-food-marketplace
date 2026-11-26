import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchOsrmRoute, isValidPoint } from '../../../shared/delivery.js';
import { GeoPoint } from '../../types/marketplace';

interface OsmMapViewProps {
  pickup: GeoPoint;
  delivery: GeoPoint;
  restaurantName: string;
  className?: string;
  interactive?: boolean;
  onLocationSelect?: (point: GeoPoint) => void;
}

function toLatLng(point: GeoPoint): L.LatLngExpression {
  return [point.lat, point.lng];
}

function createPin(label: 'R' | 'D', color: string): L.DivIcon {
  return L.divIcon({
    className: 'calabar-map-pin',
    html:
      `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;` +
      `border-radius:9999px;background:${color};color:white;font-size:11px;font-weight:700;` +
      `border:2px solid white;box-shadow:0 1px 4px rgba(28,25,23,.35)">${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export const OsmMapView: React.FC<OsmMapViewProps> = ({
  pickup,
  delivery,
  restaurantName,
  className = 'w-full h-[280px] rounded-[8px] border border-[#E7E5E4]',
  interactive = false,
  onLocationSelect,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const fallbackLineRef = useRef<L.Polyline | null>(null);
  const onSelectRef = useRef(onLocationSelect);

  const pickupLat = pickup.lat;
  const pickupLng = pickup.lng;
  const deliveryLat = delivery.lat;
  const deliveryLng = delivery.lng;
  onSelectRef.current = onLocationSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isValidPoint(pickup) || !isValidPoint(delivery)) return;

    const map = L.map(container, {
      center: toLatLng(delivery),
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: interactive,
      dragging: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const pickupMarker = L.marker(toLatLng(pickup), {
      icon: createPin('R', '#EA580C'),
      title: `Pickup · ${restaurantName}`,
    }).addTo(map);

    const deliveryMarker = L.marker(toLatLng(delivery), {
      icon: createPin('D', '#15803D'),
      title: 'Your delivery location',
      draggable: interactive,
    }).addTo(map);

    const fallbackLine = L.polyline([toLatLng(pickup), toLatLng(delivery)], {
      color: '#EA580C',
      weight: 2,
      opacity: 0.5,
      dashArray: '5 6',
    }).addTo(map);

    if (interactive) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        const point = { lat: event.latlng.lat, lng: event.latlng.lng };
        if (!isValidPoint(point)) return;
        deliveryMarker.setLatLng(toLatLng(point));
        onSelectRef.current?.(point);
      });
      deliveryMarker.on('dragend', () => {
        const position = deliveryMarker.getLatLng();
        const point = { lat: position.lat, lng: position.lng };
        if (isValidPoint(point)) onSelectRef.current?.(point);
      });
    }

    mapRef.current = map;
    pickupMarkerRef.current = pickupMarker;
    deliveryMarkerRef.current = deliveryMarker;
    fallbackLineRef.current = fallbackLine;

    const bounds = L.latLngBounds([toLatLng(pickup), toLatLng(delivery)]);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    const frame = window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      window.cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      pickupMarkerRef.current = null;
      deliveryMarkerRef.current = null;
      routeLayerRef.current = null;
      fallbackLineRef.current = null;
    };
    // The map instance is intentionally created once. Position updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    const pickupMarker = pickupMarkerRef.current;
    const deliveryMarker = deliveryMarkerRef.current;
    const fallbackLine = fallbackLineRef.current;
    if (!map || !pickupMarker || !deliveryMarker || !fallbackLine) return;
    if (!isValidPoint({ lat: pickupLat, lng: pickupLng })) return;
    if (!isValidPoint({ lat: deliveryLat, lng: deliveryLng })) return;

    const nextPickup = { lat: pickupLat, lng: pickupLng };
    const nextDelivery = { lat: deliveryLat, lng: deliveryLng };
    pickupMarker.setLatLng(toLatLng(nextPickup));
    deliveryMarker.setLatLng(toLatLng(nextDelivery));
    fallbackLine.setLatLngs([toLatLng(nextPickup), toLatLng(nextDelivery)]);
    map.fitBounds(L.latLngBounds([toLatLng(nextPickup), toLatLng(nextDelivery)]), {
      padding: [32, 32],
      maxZoom: 15,
    });
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isValidPoint({ lat: pickupLat, lng: pickupLng })) return;
    if (!isValidPoint({ lat: deliveryLat, lng: deliveryLng })) return;

    let cancelled = false;
    void fetchOsrmRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: deliveryLat, lng: deliveryLng },
      { withGeometry: true },
    ).then((route) => {
      if (cancelled || !route?.geometry?.length || !mapRef.current) return;
      routeLayerRef.current?.remove();
      routeLayerRef.current = L.polyline(
        route.geometry.map((point) => toLatLng(point)),
        { color: '#EA580C', weight: 4, opacity: 0.85 },
      ).addTo(mapRef.current);
    });

    return () => {
      cancelled = true;
      routeLayerRef.current?.remove();
      routeLayerRef.current = null;
    };
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  return (
    <div
      ref={containerRef}
      className={`${className} bg-[#F5F5F4] overflow-hidden z-0`}
      aria-label={`OpenStreetMap showing pickup from ${restaurantName} and the delivery location`}
    />
  );
};
