'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationMiniMapProps {
    lat: number;
    lng: number;
    color?: string;
    height?: number;
}

export default function LocationMiniMap({ lat, lng, color = '#C62828', height = 120 }: LocationMiniMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [lat, lng],
            zoom: 16,
            zoomControl: false,
            scrollWheelZoom: false,
            dragging: false,
            doubleClickZoom: false,
            attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        // Pin marker
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background-color: ${color};
                border: 3px solid white;
                box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
        });

        L.marker([lat, lng], { icon }).addTo(map);

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [lat, lng, color]);

    return (
        <div
            ref={containerRef}
            className="w-full rounded border border-border overflow-hidden"
            style={{ height: `${height}px` }}
        />
    );
}
