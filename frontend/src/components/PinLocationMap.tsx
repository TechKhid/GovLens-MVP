'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PinLocationMapProps {
    lat: number;
    lng: number;
    onPinChange: (lat: number, lng: number) => void;
    height?: number;
}

// Ayawaso West Wuogon center
const AWW_CENTER: [number, number] = [5.6150, -0.1900];

export default function PinLocationMap({ lat, lng, onPinChange, height = 180 }: PinLocationMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const onPinChangeRef = useRef(onPinChange);
    onPinChangeRef.current = onPinChange;

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: lat && lng ? [lat, lng] : AWW_CENTER,
            zoom: 15,
            zoomControl: true,
            scrollWheelZoom: true,
            attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        // Create draggable pin
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background-color: #C62828;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                cursor: grab;
            "></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });

        const marker = L.marker([lat || AWW_CENTER[0], lng || AWW_CENTER[1]], {
            icon,
            draggable: true,
        }).addTo(map);

        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onPinChangeRef.current(pos.lat, pos.lng);
        });

        // Click on map to reposition pin
        map.on('click', (e: L.LeafletMouseEvent) => {
            marker.setLatLng(e.latlng);
            onPinChangeRef.current(e.latlng.lat, e.latlng.lng);
        });

        markerRef.current = marker;
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            ref={containerRef}
            className="w-full rounded border border-border overflow-hidden cursor-crosshair"
            style={{ height: `${height}px` }}
        />
    );
}
