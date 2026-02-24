'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Issue, SEVERITY_COLORS, ZoneData, getZoneSeverity } from '@/lib/mockData';

interface LeafletMapProps {
    issues: Issue[];
    zones: ZoneData[];
    selectedZone: ZoneData | null;
    onZoneSelect: (zone: ZoneData | null) => void;
    onIssueSelect: (issueId: string) => void;
}

// Ayawaso West Wuogon center coordinates
const AWW_CENTER: [number, number] = [5.5825, -0.2010];
const AWW_ZOOM = 14;

// Approximate boundary polygon for Ayawaso West Wuogon
const AWW_BOUNDARY: [number, number][] = [
    [5.5650, -0.2200],
    [5.5650, -0.1850],
    [5.5720, -0.1820],
    [5.5850, -0.1830],
    [5.5950, -0.1870],
    [5.6020, -0.1900],
    [5.6050, -0.1950],
    [5.6030, -0.2050],
    [5.5980, -0.2150],
    [5.5900, -0.2200],
    [5.5800, -0.2230],
    [5.5700, -0.2220],
    [5.5650, -0.2200],
];

// Zone approximate centers (refined real coordinates)
const ZONE_COORDS: Record<string, [number, number]> = {
    'Nima': [5.5780, -0.2050],
    'Mamobi': [5.5735, -0.2080],
    'Kanda': [5.5845, -0.1920],
    'New Town': [5.5700, -0.2130],
    'Abelemkpe': [5.5890, -0.2010],
    'Dzorwulu': [5.5950, -0.1980],
};

function createSeverityIcon(severity: string, isSelected: boolean = false): L.DivIcon {
    const color = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '#6B6B6B';
    const size = isSelected ? 14 : 10;
    const borderSize = isSelected ? 3 : 2;

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background-color: ${color};
            border: ${borderSize}px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            transition: all 0.2s;
        "></div>`,
        iconSize: [size + borderSize * 2, size + borderSize * 2],
        iconAnchor: [(size + borderSize * 2) / 2, (size + borderSize * 2) / 2],
    });
}

function createZoneIcon(zone: ZoneData, isSelected: boolean): L.DivIcon {
    const severity = getZoneSeverity(zone.issueCount);
    const color = SEVERITY_COLORS[severity];
    const size = isSelected ? 42 : 36;

    return L.divIcon({
        className: 'zone-marker',
        html: `<div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background-color: ${color};
            opacity: ${isSelected ? 0.85 : 0.65};
            border: 2px solid ${isSelected ? '#111' : color};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 11px;
            font-weight: 700;
            font-family: 'IBM Plex Mono', monospace;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            cursor: pointer;
            transition: all 0.2s;
        ">${zone.issueCount}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

export default function LeafletMap({
    issues,
    zones,
    selectedZone,
    onZoneSelect,
    onIssueSelect,
}: LeafletMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const zoneMarkersRef = useRef<L.Marker[]>([]);
    const issueMarkersRef = useRef<L.Marker[]>([]);
    const heatCirclesRef = useRef<L.Circle[]>([]);
    const boundaryRef = useRef<L.Polygon | null>(null);

    // Stable callback refs to avoid re-creating map on every render
    const onZoneSelectRef = useRef(onZoneSelect);
    const onIssueSelectRef = useRef(onIssueSelect);
    onZoneSelectRef.current = onZoneSelect;
    onIssueSelectRef.current = onIssueSelect;

    // Initialize map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: AWW_CENTER,
            zoom: AWW_ZOOM,
            zoomControl: true,
            scrollWheelZoom: true,
            attributionControl: true,
        });

        // OpenStreetMap tile layer (free, no API key)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        // Constituency boundary
        const boundary = L.polygon(AWW_BOUNDARY, {
            color: '#111111',
            weight: 2,
            opacity: 0.6,
            fillColor: '#111111',
            fillOpacity: 0.03,
            dashArray: '6, 4',
        }).addTo(map);

        boundary.bindTooltip('Ayawaso West Wuogon', {
            permanent: false,
            direction: 'center',
            className: 'constituency-tooltip',
        });

        boundaryRef.current = boundary;
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Update zone markers and heat circles
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear previous zone markers and circles
        zoneMarkersRef.current.forEach((m) => m.remove());
        zoneMarkersRef.current = [];
        heatCirclesRef.current.forEach((c) => c.remove());
        heatCirclesRef.current = [];

        zones.forEach((zone) => {
            const coords = ZONE_COORDS[zone.name];
            if (!coords) return;

            const severity = getZoneSeverity(zone.issueCount);
            const color = SEVERITY_COLORS[severity];
            const isSelected = selectedZone?.id === zone.id;

            // Heat radius circle
            const heatRadius = 200 + (zone.issueCount * 3);
            const circle = L.circle(coords, {
                radius: heatRadius,
                color: color,
                weight: 0,
                fillColor: color,
                fillOpacity: isSelected ? 0.18 : 0.10,
            }).addTo(map);
            heatCirclesRef.current.push(circle);

            // Zone label marker
            const marker = L.marker(coords, {
                icon: createZoneIcon(zone, isSelected),
                zIndexOffset: isSelected ? 1000 : 500,
            }).addTo(map);

            marker.bindTooltip(
                `<strong>${zone.name}</strong><br/>Issues: ${zone.issueCount} · Resolved: ${zone.resolvedCount}`,
                { direction: 'top', offset: [0, -20] }
            );

            marker.on('click', () => {
                onZoneSelectRef.current(isSelected ? null : zone);
            });

            zoneMarkersRef.current.push(marker);
        });
    }, [zones, selectedZone]);

    // Update issue markers when zone is selected
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear previous issue markers
        issueMarkersRef.current.forEach((m) => m.remove());
        issueMarkersRef.current = [];

        if (!selectedZone) return;

        // Show individual issue pins for the selected zone
        const zoneIssues = issues.filter((i) => i.zone === selectedZone.name);

        zoneIssues.forEach((issue) => {
            const coords: [number, number] = [issue.location.gps.lat, issue.location.gps.lng];
            const icon = createSeverityIcon(issue.severity, false);

            const marker = L.marker(coords, {
                icon,
                zIndexOffset: 100,
            }).addTo(map);

            marker.bindTooltip(
                `<strong>${issue.title}</strong><br/>${issue.status} · ${issue.severity}`,
                { direction: 'top', offset: [0, -8] }
            );

            marker.on('click', () => {
                onIssueSelectRef.current(issue.id);
            });

            issueMarkersRef.current.push(marker);
        });

        // Fly to the selected zone
        const zoneCoords = ZONE_COORDS[selectedZone.name];
        if (zoneCoords) {
            map.flyTo(zoneCoords, 15, { duration: 0.8 });
        }
    }, [selectedZone, issues]);

    // Fly back to overview when deselecting
    const prevSelectedRef = useRef(selectedZone);
    useEffect(() => {
        if (prevSelectedRef.current && !selectedZone && mapRef.current) {
            mapRef.current.flyTo(AWW_CENTER, AWW_ZOOM, { duration: 0.8 });
        }
        prevSelectedRef.current = selectedZone;
    }, [selectedZone]);

    return (
        <div
            ref={containerRef}
            className="w-full rounded-lg overflow-hidden"
            style={{ height: '500px' }}
        />
    );
}
