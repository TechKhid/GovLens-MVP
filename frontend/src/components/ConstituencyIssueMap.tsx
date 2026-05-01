'use client';

import type { Color } from '@deck.gl/core';
import { AdvancedMarker, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GoogleMapsContainer from '@/components/google-maps/GoogleMapsContainer';
import GooglePlaceSearch from '@/components/google-maps/GooglePlaceSearch';
import {
    buildViewportBias,
    CONSTITUENCY_ZOOM,
    fitMapToPlace,
    getConstituencyMapCenter,
    GHANA_OVERVIEW_ZOOM,
    getIssuePosition,
    getWeightedIssuePoints,
    type GooglePlaceSelection,
    type WeightedIssuePoint,
} from '@/lib/google-maps';
import { type Issue, type ZoneData, SEVERITY_COLORS, getZoneSeverity } from '@/lib/mockData';

interface ConstituencyIssueMapProps {
    constituency: string;
    issues: Issue[];
    onIssueSelect: (issueId: string) => void;
    onZoneSelect: (zone: ZoneData | null) => void;
    selectedZone: ZoneData | null;
    zones: ZoneData[];
}

const HEATMAP_COLORS: Color[] = [
    [245, 166, 35],
    [245, 124, 0],
    [198, 40, 40],
];

const CONSTITUENCY_MAP_INSTANCE_ID = 'constituency-issue-map';

type ZoneMarkerData = ZoneData & google.maps.LatLngLiteral;

function fitPositions(map: google.maps.Map, positions: google.maps.LatLngLiteral[]): void {
    if (positions.length === 0) return;

    if (positions.length === 1) {
        map.panTo(positions[0]);
        map.setZoom(16);
        return;
    }

    const bounds = new google.maps.LatLngBounds();
    positions.forEach((position) => bounds.extend(position));
    map.fitBounds(bounds, 88);
}

function HeatmapOverlay({
    points,
}: {
    points: WeightedIssuePoint[];
}) {
    const map = useMap();
    const overlayRef = useRef<GoogleMapsOverlay | null>(null);

    useEffect(() => {
        if (!map) return;

        if (!overlayRef.current) {
            overlayRef.current = new GoogleMapsOverlay({
                layers: [],
            });
        }

        overlayRef.current.setMap(map);

        return () => {
            overlayRef.current?.setMap(null);
        };
    }, [map]);

    useEffect(() => {
        if (!overlayRef.current) return;

        overlayRef.current.setProps({
            layers: [
                new HeatmapLayer({
                    id: 'govlens-issue-heatmap',
                    colorRange: HEATMAP_COLORS,
                    data: points,
                    getPosition: (point: WeightedIssuePoint) => point.position,
                    getWeight: (point: WeightedIssuePoint) => point.weight,
                    intensity: 0.9,
                    pickable: false,
                    radiusPixels: 52,
                    threshold: 0.04,
                }),
            ],
        });
    }, [points]);

    useEffect(() => {
        return () => {
            overlayRef.current?.finalize();
            overlayRef.current = null;
        };
    }, []);

    return null;
}

function ViewportController({
    constituencyCenter,
    selectedZone,
    suppressResetRef,
    zoneCentroid,
    zoneIssuePositions,
}: {
    constituencyCenter: google.maps.LatLngLiteral;
    selectedZone: ZoneData | null;
    suppressResetRef: React.MutableRefObject<boolean>;
    zoneCentroid: google.maps.LatLngLiteral | null;
    zoneIssuePositions: google.maps.LatLngLiteral[];
}) {
    const map = useMap();
    const previousZoneIdRef = useRef<string | null>(selectedZone?.id ?? null);

    useEffect(() => {
        if (!map) return;

        const previousZoneId = previousZoneIdRef.current;
        const nextZoneId = selectedZone?.id ?? null;

        if (nextZoneId && nextZoneId !== previousZoneId) {
            if (zoneIssuePositions.length > 0) {
                fitPositions(map, zoneIssuePositions);
            } else if (zoneCentroid) {
                map.panTo(zoneCentroid);
                map.setZoom(15);
            }
        }

        if (!nextZoneId && previousZoneId) {
            if (suppressResetRef.current) {
                suppressResetRef.current = false;
            } else {
                map.panTo(constituencyCenter);
                map.setZoom(CONSTITUENCY_ZOOM);
            }
        }

        previousZoneIdRef.current = nextZoneId;
    }, [constituencyCenter, map, selectedZone?.id, suppressResetRef, zoneCentroid, zoneIssuePositions]);

    return null;
}

function ZoneMarker({
    isSelected,
    onClick,
    zone,
}: {
    isSelected: boolean;
    onClick: () => void;
    zone: ZoneMarkerData;
}) {
    const severity = getZoneSeverity(zone.issueCount);
    const color = SEVERITY_COLORS[severity];

    return (
        <AdvancedMarker
            clickable
            onClick={onClick}
            position={zone}
            title={`${zone.name}: ${zone.issueCount} issues, ${zone.resolvedCount} resolved`}
            zIndex={isSelected ? 30 : 20}
        >
            <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-[11px] font-mono font-semibold text-white shadow-[0_10px_24px_rgba(17,24,39,0.18)] transition-transform"
                style={{
                    backgroundColor: color,
                    borderColor: isSelected ? '#111827' : '#FFFFFF',
                    opacity: isSelected ? 0.92 : 0.76,
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                }}
            >
                {zone.issueCount}
            </div>
        </AdvancedMarker>
    );
}

function IssueMarker({
    issue,
    onClick,
}: {
    issue: Issue;
    onClick: () => void;
}) {
    const position = getIssuePosition(issue);
    if (!position) return null;

    return (
        <AdvancedMarker
            clickable
            onClick={onClick}
            position={position}
            title={`${issue.title} — ${issue.status} · ${issue.severity}`}
            zIndex={40}
        >
            <div
                className="h-4 w-4 rounded-full border-[3px] border-white shadow-[0_8px_18px_rgba(17,24,39,0.2)]"
                style={{ backgroundColor: SEVERITY_COLORS[issue.severity] }}
            />
        </AdvancedMarker>
    );
}

function ConstituencyIssueMapInner({
    constituency,
    issues,
    mapId,
    onIssueSelect,
    onZoneSelect,
    selectedZone,
    zones,
}: ConstituencyIssueMapProps & {
    mapId: string;
}) {
    const map = useMap(CONSTITUENCY_MAP_INSTANCE_ID);
    const [searchBias, setSearchBias] = useState<google.maps.LatLngBoundsLiteral | null>(null);
    const [searchOrigin, setSearchOrigin] = useState<google.maps.LatLngLiteral>(() => getConstituencyMapCenter(constituency));
    const suppressResetRef = useRef(false);

    const constituencyCenter = useMemo(
        () => getConstituencyMapCenter(constituency),
        [constituency],
    );

    const heatmapPoints = useMemo(
        () => getWeightedIssuePoints(issues),
        [issues],
    );

    const zoneCentroids = useMemo(() => {
        const accumulator = new Map<string, { count: number; lat: number; lng: number }>();

        issues.forEach((issue) => {
            const position = getIssuePosition(issue);
            if (!position || !issue.zone) return;

            const current = accumulator.get(issue.zone) ?? { count: 0, lat: 0, lng: 0 };
            current.count += 1;
            current.lat += position.lat;
            current.lng += position.lng;
            accumulator.set(issue.zone, current);
        });

        const next: Record<string, google.maps.LatLngLiteral> = {};

        accumulator.forEach((entry, zone) => {
            next[zone] = {
                lat: entry.lat / entry.count,
                lng: entry.lng / entry.count,
            };
        });

        return next;
    }, [issues]);

    const activeZoneIssues = useMemo(
        () => selectedZone ? issues.filter((issue) => issue.zone === selectedZone.name) : [],
        [issues, selectedZone],
    );

    const activeZonePositions = useMemo(
        () => activeZoneIssues.map(getIssuePosition).filter((position): position is google.maps.LatLngLiteral => Boolean(position)),
        [activeZoneIssues],
    );

    const selectedZoneCentroid = selectedZone ? zoneCentroids[selectedZone.name] ?? null : null;

    const handleSearchSelect = useCallback((place: GooglePlaceSelection) => {
        if (!map) return;

        if (selectedZone) {
            suppressResetRef.current = true;
            onZoneSelect(null);
        }

        fitMapToPlace(map, place);
    }, [map, onZoneSelect, selectedZone]);

    return (
        <div className="relative h-full overflow-hidden rounded-lg border border-border">
            <div className="absolute left-3 right-3 top-3 z-10 md:left-4 md:right-auto md:w-[340px]">
                <GooglePlaceSearch
                    bias={buildViewportBias(searchBias, constituencyCenter)}
                    onPlaceSelect={handleSearchSelect}
                    origin={searchOrigin}
                    placeholder="Search for an area, landmark, or address in Ghana"
                />
            </div>

            <GoogleMap
                id={CONSTITUENCY_MAP_INSTANCE_ID}
                className="h-full w-full"
                defaultCenter={constituencyCenter}
                defaultZoom={constituency ? CONSTITUENCY_ZOOM : GHANA_OVERVIEW_ZOOM}
                disableDefaultUI={false}
                fullscreenControl={false}
                gestureHandling="greedy"
                mapId={mapId}
                mapTypeControl={false}
                onCameraChanged={(event) => {
                    setSearchOrigin(event.detail.center);
                    setSearchBias(event.detail.bounds);
                }}
                reuseMaps
                streetViewControl={false}
            >
                <HeatmapOverlay points={heatmapPoints} />

                {zones.map((zone) => {
                    const centroid = zoneCentroids[zone.name];
                    if (!centroid) return null;

                    return (
                        <ZoneMarker
                            key={zone.id}
                            isSelected={selectedZone?.id === zone.id}
                            onClick={() => onZoneSelect(selectedZone?.id === zone.id ? null : zone)}
                            zone={{
                                ...zone,
                                ...centroid,
                            }}
                        />
                    );
                })}

                {selectedZone && activeZoneIssues.map((issue) => (
                    <IssueMarker
                        key={issue.id}
                        issue={issue}
                        onClick={() => onIssueSelect(issue.id)}
                    />
                ))}

                <ViewportController
                    constituencyCenter={constituencyCenter}
                    selectedZone={selectedZone}
                    suppressResetRef={suppressResetRef}
                    zoneCentroid={selectedZoneCentroid}
                    zoneIssuePositions={activeZonePositions}
                />
            </GoogleMap>
        </div>
    );
}

export default function ConstituencyIssueMap(props: ConstituencyIssueMapProps) {
    return (
        <GoogleMapsContainer
            className="w-full"
            height={500}
            loadingLabel="Loading map..."
        >
            {(config) => (
                <ConstituencyIssueMapInner
                    {...props}
                    mapId={config.mapId}
                />
            )}
        </GoogleMapsContainer>
    );
}
