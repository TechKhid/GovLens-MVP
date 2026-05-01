'use client';

import { useMemo } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import {
    MINI_MAP_ZOOM,
    getConstituencyMapCenter,
    hasMeaningfulCoordinates,
} from '@/lib/issue-map';
import MapLibreMap from '@/components/open-maps/MapLibreMap';

interface LocationMiniMapProps {
    lat: number;
    lng: number;
    color?: string;
    height?: number;
}

export default function LocationMiniMap({ lat, lng, color = '#C62828', height = 120 }: LocationMiniMapProps) {
    const fallbackCenter = useMemo(
        () => getConstituencyMapCenter('Ayawaso West Wuogon'),
        [],
    );
    const position = hasMeaningfulCoordinates(lat, lng) ? { lat, lng } : fallbackCenter;

    return (
        <MapLibreMap
            attributionControl={false}
            doubleClickZoom={false}
            dragPan={false}
            height={height}
            initialViewState={{
                latitude: position.lat,
                longitude: position.lng,
                zoom: MINI_MAP_ZOOM,
            }}
            interactive={false}
            keyboard={false}
            latitude={position.lat}
            longitude={position.lng}
            scrollZoom={false}
            showNavigation={false}
            showScale={false}
            touchZoomRotate={false}
            zoom={MINI_MAP_ZOOM}
        >
            <Marker
                anchor="center"
                latitude={position.lat}
                longitude={position.lng}
            >
                <div
                    aria-hidden
                    className="h-[18px] w-[18px] rounded-full border-[3px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    style={{ backgroundColor: color }}
                />
            </Marker>
        </MapLibreMap>
    );
}
