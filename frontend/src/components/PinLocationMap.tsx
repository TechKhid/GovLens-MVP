'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, type MapRef } from 'react-map-gl/maplibre';
import {
    PIN_MAP_ZOOM,
    getConstituencyMapCenter,
    hasMeaningfulCoordinates,
} from '@/lib/issue-map';
import MapLibreMap from '@/components/open-maps/MapLibreMap';

interface PinLocationMapProps {
    lat: number;
    lng: number;
    onPinChange: (lat: number, lng: number) => void;
    height?: number;
}

export default function PinLocationMap({ lat, lng, onPinChange, height = 180 }: PinLocationMapProps) {
    const fallbackCenter = useMemo(
        () => getConstituencyMapCenter('Ayawaso West Wuogon'),
        [],
    );
    const mapRef = useRef<MapRef | null>(null);
    const [pinPosition, setPinPosition] = useState(() =>
        hasMeaningfulCoordinates(lat, lng) ? { lat, lng } : fallbackCenter,
    );

    useEffect(() => {
        const nextPosition = hasMeaningfulCoordinates(lat, lng)
            ? { lat, lng }
            : fallbackCenter;

        setPinPosition((current) => {
            if (
                Math.abs(current.lat - nextPosition.lat) < 0.000001
                && Math.abs(current.lng - nextPosition.lng) < 0.000001
            ) {
                return current;
            }

            return nextPosition;
        });

        mapRef.current?.flyTo({
            center: [nextPosition.lng, nextPosition.lat],
            duration: 0,
            zoom: PIN_MAP_ZOOM,
        });
    }, [fallbackCenter, lat, lng]);

    const updatePin = (nextLat: number, nextLng: number) => {
        setPinPosition({ lat: nextLat, lng: nextLng });
        onPinChange(nextLat, nextLng);
    };

    return (
        <MapLibreMap
            attributionControl={false}
            height={height}
            initialViewState={{
                latitude: pinPosition.lat,
                longitude: pinPosition.lng,
                zoom: PIN_MAP_ZOOM,
            }}
            onClick={(event) => updatePin(event.lngLat.lat, event.lngLat.lng)}
            ref={mapRef}
            showScale={false}
        >
            <Marker
                anchor="center"
                draggable
                latitude={pinPosition.lat}
                longitude={pinPosition.lng}
                onDragEnd={(event) => updatePin(event.lngLat.lat, event.lngLat.lng)}
            >
                <div
                    aria-hidden
                    className="h-5 w-5 rounded-full border-[3px] border-white bg-[#C62828] shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
                />
            </Marker>
        </MapLibreMap>
    );
}
