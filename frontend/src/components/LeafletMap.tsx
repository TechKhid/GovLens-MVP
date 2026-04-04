'use client';

import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Issue, SEVERITY_COLORS, ZoneData, getZoneSeverity } from '@/lib/mockData';

interface LeafletMapProps {
    issues: Issue[];
    zones: ZoneData[];
    selectedZone: ZoneData | null;
    onZoneSelect: (zone: ZoneData | null) => void;
    onIssueSelect: (issueId: string) => void;
    constituency: string;
}

// Static pre-geocoded coordinates for every Ghana constituency.
// Generated once by: node scripts/geocode-constituencies.js
import constituencyCenters, { getConstituencyCenter } from '@/lib/constituency-centers';

// Ghana national center — shown until constituency geocoding resolves
const GHANA_CENTER: [number, number] = [7.9465, -1.0232];
const GHANA_ZOOM = 7;
const CONSTITUENCY_ZOOM = 12;
const CACHE_PREFIX = 'govlens:geo:';

/**
 * Resolve a constituency center using this priority chain:
 *  1. Pre-generated static JSON (instant, no network)
 *  2. localStorage cache from a previous Nominatim call
 *  3. Nominatim API — tries "Name Ghana", "Name District Ghana" with countrycodes=gh
 *  4. Returns null → caller falls back to Ghana national center
 */
async function geocodeConstituency(name: string): Promise<[number, number] | null> {
    if (!name) return null;

    // 1. Static JSON — fastest, most reliable, zero network calls
    if (constituencyCenters[name]) {
        const { lat, lng } = constituencyCenters[name];
        return [lat, lng];
    }

    // 2. localStorage cache
    const cacheKey = `${CACHE_PREFIX}${name}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached) as [number, number];
    } catch { /* ignore */ }

    // 3. Nominatim — multiple query strategies, Ghana-restricted
    const queries = [
        `${name} Ghana`,
        `${name} District Ghana`,
        `${name} Constituency Ghana`,
    ];

    for (const q of queries) {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&countrycodes=gh&addressdetails=1`;
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'GovLens-MVP/1.0 (civic-platform Ghana)' },
            });
            const data: Array<{ lat: string; lon: string; class: string; address?: { country_code?: string } }> = await res.json();

            // Prefer administrative / place results within Ghana
            const best = data.find(
                (r) => r.address?.country_code === 'gh' &&
                    ['administrative', 'boundary', 'place', 'town', 'village', 'city'].includes(r.class)
            ) ?? data[0];

            if (best) {
                const coords: [number, number] = [parseFloat(best.lat), parseFloat(best.lon)];
                localStorage.setItem(cacheKey, JSON.stringify(coords));
                return coords;
            }
        } catch (err) {
            console.warn(`Nominatim failed for "${q}":`, err);
        }
        // Respect 1 req/s rate limit
        await new Promise((r) => setTimeout(r, 1100));
    }

    return null;
}

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
    constituency,
}: LeafletMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const zoneMarkersRef = useRef<L.Marker[]>([]);
    const issueMarkersRef = useRef<L.Marker[]>([]);
    const heatCirclesRef = useRef<L.Circle[]>([]);

    const onZoneSelectRef = useRef(onZoneSelect);
    const onIssueSelectRef = useRef(onIssueSelect);
    onZoneSelectRef.current = onZoneSelect;
    onIssueSelectRef.current = onIssueSelect;

    // ── Compute zone centroids from real issue GPS data ────────────────────
    // Each zone pin lands at the average lat/lng of all issues in that zone.
    const zoneCentroids = useMemo(() => {
        const acc: Record<string, { sumLat: number; sumLng: number; count: number }> = {};
        issues.forEach((issue) => {
            const { lat, lng } = issue.location.gps;
            if (!issue.zone || (lat === 0 && lng === 0)) return;
            if (!acc[issue.zone]) acc[issue.zone] = { sumLat: 0, sumLng: 0, count: 0 };
            acc[issue.zone].sumLat += lat;
            acc[issue.zone].sumLng += lng;
            acc[issue.zone].count += 1;
        });
        const result: Record<string, [number, number]> = {};
        Object.entries(acc).forEach(([zone, { sumLat, sumLng, count }]) => {
            result[zone] = [sumLat / count, sumLng / count];
        });
        return result;
    }, [issues]);

    // ── Initialize map once ────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: GHANA_CENTER,
            zoom: GHANA_ZOOM,
            zoomControl: true,
            scrollWheelZoom: true,
            attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // ── Fly to constituency via Nominatim once map and constituency are ready
    useEffect(() => {
        if (!constituency) return;

        // Wait for map to be ready (retry a few times if necessary)
        let cancelled = false;
        const fly = async () => {
            const coords = await geocodeConstituency(constituency);
            if (cancelled || !coords) return;
            // Map might have just initialised — wait a tick
            setTimeout(() => {
                if (!cancelled && mapRef.current) {
                    mapRef.current.flyTo(coords, CONSTITUENCY_ZOOM, { duration: 1.2 });
                }
            }, 300);
        };
        fly();
        return () => { cancelled = true; };
    }, [constituency]);

    // ── Update zone markers and heat circles ───────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        zoneMarkersRef.current.forEach((m) => m.remove());
        zoneMarkersRef.current = [];
        heatCirclesRef.current.forEach((c) => c.remove());
        heatCirclesRef.current = [];

        zones.forEach((zone) => {
            const coords = zoneCentroids[zone.name];
            if (!coords) return; // skip zones with no GPS-bearing issues

            const severity = getZoneSeverity(zone.issueCount);
            const color = SEVERITY_COLORS[severity];
            const isSelected = selectedZone?.id === zone.id;

            // Heat radius circle
            const heatRadius = 200 + zone.issueCount * 3;
            const circle = L.circle(coords, {
                radius: heatRadius,
                color,
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
    }, [zones, selectedZone, zoneCentroids]);

    // ── Show individual issue pins when a zone is selected ─────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        issueMarkersRef.current.forEach((m) => m.remove());
        issueMarkersRef.current = [];

        if (!selectedZone) return;

        const zoneIssues = issues.filter((i) => i.zone === selectedZone.name);

        zoneIssues.forEach((issue) => {
            const { lat, lng } = issue.location.gps;
            if (lat === 0 && lng === 0) return;
            const coords: [number, number] = [lat, lng];
            const icon = createSeverityIcon(issue.severity, false);

            const marker = L.marker(coords, { icon, zIndexOffset: 100 }).addTo(map);
            marker.bindTooltip(
                `<strong>${issue.title}</strong><br/>${issue.status} · ${issue.severity}`,
                { direction: 'top', offset: [0, -8] }
            );
            marker.on('click', () => onIssueSelectRef.current(issue.id));
            issueMarkersRef.current.push(marker);
        });

        // Fly to zone centroid
        const zoneCoords = zoneCentroids[selectedZone.name];
        if (zoneCoords) {
            map.flyTo(zoneCoords, 15, { duration: 0.8 });
        }
    }, [selectedZone, issues, zoneCentroids]);

    // ── Fly back to constituency overview when zone is deselected ──────────
    const prevSelectedRef = useRef(selectedZone);
    useEffect(() => {
        if (prevSelectedRef.current && !selectedZone && mapRef.current) {
            geocodeConstituency(constituency).then((coords) => {
                if (coords && mapRef.current) {
                    mapRef.current.flyTo(coords, CONSTITUENCY_ZOOM, { duration: 0.8 });
                }
            });
        }
        prevSelectedRef.current = selectedZone;
    }, [selectedZone, constituency]);

    return (
        <div
            ref={containerRef}
            className="w-full rounded-lg overflow-hidden"
            style={{ height: '500px' }}
        />
    );
}
