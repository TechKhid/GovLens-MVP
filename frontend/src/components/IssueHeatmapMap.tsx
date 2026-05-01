'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContourLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { Color } from '@deck.gl/core';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import { type Issue, type ZoneData } from '@/lib/mockData';
import {
    CONSTITUENCY_ZOOM,
    GHANA_CENTER,
    GHANA_OVERVIEW_ZOOM,
    ZONE_FOCUS_ZOOM,
    getConstituencyMapCenter,
    getIssuePosition,
    getMeanPosition,
    getPositionsBounds,
    getWeightedIssuePoints,
    getZoneCentroids,
} from '@/lib/issue-map';
import DeckOverlay from '@/components/open-maps/DeckOverlay';
import MapLibreMap from '@/components/open-maps/MapLibreMap';
import {
    getLocalMapTone,
    getMapToneAccent,
    getMapToneLabel,
    type MapTone,
} from '@/components/open-maps/map-style';

interface IssueHeatmapMapProps {
    issues: Issue[];
    zones: ZoneData[];
    selectedZone: ZoneData | null;
    onZoneSelect: (zone: ZoneData | null) => void;
    onIssueSelect: (issueId: string) => void;
    constituency: string;
}

interface ZoneOverlayPoint {
    color: string;
    isSelected: boolean;
    issueCount: number;
    position: [number, number];
    pressure: number;
    radius: number;
    zone: ZoneData;
}

interface IssueOverlayPoint {
    issueId: string;
    position: [number, number];
    severity: Issue['severity'];
}

const HEATMAP_COLORS: Record<MapTone, Color[]> = {
    day: [
        [255, 245, 222, 0],
        [250, 204, 21, 82],
        [249, 115, 22, 126],
        [239, 68, 68, 170],
        [159, 18, 57, 222],
        [91, 33, 182, 255],
    ],
    dusk: [
        [255, 214, 102, 0],
        [251, 146, 60, 90],
        [249, 115, 22, 138],
        [225, 29, 72, 186],
        [126, 34, 206, 228],
        [67, 56, 202, 255],
    ],
    night: [
        [34, 211, 238, 0],
        [56, 189, 248, 76],
        [129, 140, 248, 120],
        [251, 146, 60, 170],
        [239, 68, 68, 222],
        [250, 204, 21, 255],
    ],
};

const MAP_TONE_DETAILS: Record<MapTone, string> = {
    day: 'Ivory newsroom layer for daylight triage and clear civic scanning.',
    dusk: 'Warm transition palette for evening pressure checks across the constituency.',
    night: 'Deep control-room layer for after-hours monitoring and emergency watch.',
};

function severityScore(issue: Issue): number {
    switch (issue.severity) {
        case 'Critical':
            return 4;
        case 'High':
            return 3;
        case 'Medium':
            return 2;
        case 'Low':
        default:
            return 1;
    }
}

function hexToRgb(hex: string): [number, number, number] {
    const normalized = hex.replace('#', '');
    const fullHex = normalized.length === 3
        ? normalized.split('').map((value) => value + value).join('')
        : normalized;

    const parsed = Number.parseInt(fullHex, 16);
    return [
        (parsed >> 16) & 255,
        (parsed >> 8) & 255,
        parsed & 255,
    ];
}

function withAlpha(hex: string, alpha: number): Color {
    const [red, green, blue] = hexToRgb(hex);
    return [red, green, blue, alpha];
}

function getPressureColor(pressure: number): string {
    if (pressure >= 18) return '#be123c';
    if (pressure >= 13) return '#ea580c';
    if (pressure >= 9) return '#f59e0b';
    return '#d97706';
}

function getIssueSeverityColor(severity: Issue['severity']): string {
    switch (severity) {
        case 'Critical':
            return '#be123c';
        case 'High':
            return '#ea580c';
        case 'Medium':
            return '#f59e0b';
        case 'Low':
        default:
            return '#d97706';
    }
}

function getZoneRadius(issueCount: number): number {
    return Math.min(25, 11 + issueCount * 1.55);
}

function getLabelColor(mapTone: MapTone, isSelected: boolean): Color {
    if (mapTone === 'night') {
        return isSelected ? [255, 247, 237, 255] : [226, 232, 240, 255];
    }

    if (mapTone === 'dusk') {
        return isSelected ? [255, 244, 230, 255] : [241, 245, 249, 255];
    }

    return isSelected ? [15, 23, 42, 255] : [71, 85, 105, 255];
}

function getZoneCoreFill(mapTone: MapTone): Color {
    if (mapTone === 'night') return [12, 18, 34, 226];
    if (mapTone === 'dusk') return [30, 36, 56, 220];
    return [255, 250, 240, 238];
}

function getIssueStrokeColor(mapTone: MapTone): Color {
    return mapTone === 'day' ? [255, 255, 255, 252] : [15, 23, 42, 248];
}

function getContourConfig(mapTone: MapTone): {
    contours: Array<{ color: Color; strokeWidth: number; threshold: number }>;
    radiusPixels: number;
    weightScale: number;
} {
    switch (mapTone) {
        case 'night':
            return {
                contours: [
                    { threshold: 0.28, color: [56, 189, 248, 116], strokeWidth: 1.8 },
                    { threshold: 0.82, color: [129, 140, 248, 166], strokeWidth: 2.6 },
                    { threshold: 1.55, color: [249, 115, 22, 212], strokeWidth: 3.4 },
                ],
                radiusPixels: 70,
                weightScale: 1.35,
            };
        case 'dusk':
            return {
                contours: [
                    { threshold: 0.34, color: [249, 115, 22, 108], strokeWidth: 1.6 },
                    { threshold: 0.95, color: [225, 29, 72, 154], strokeWidth: 2.4 },
                    { threshold: 1.8, color: [79, 70, 229, 206], strokeWidth: 3.2 },
                ],
                radiusPixels: 64,
                weightScale: 1.18,
            };
        case 'day':
        default:
            return {
                contours: [
                    { threshold: 0.38, color: [250, 204, 21, 96], strokeWidth: 1.4 },
                    { threshold: 1.05, color: [249, 115, 22, 144], strokeWidth: 2.2 },
                    { threshold: 1.92, color: [190, 24, 93, 198], strokeWidth: 3 },
                ],
                radiusPixels: 60,
                weightScale: 1.05,
            };
    }
}

function stopDeckEvent(event: unknown): void {
    const deckEvent = event as
        | { stopPropagation?: () => void; srcEvent?: { stopPropagation?: () => void } }
        | undefined;

    deckEvent?.stopPropagation?.();
    deckEvent?.srcEvent?.stopPropagation?.();
}

function zonePressure(zone: ZoneData, issues: Issue[]): number {
    const zoneIssues = issues.filter((issue) => issue.zone === zone.name);
    const unresolved = zone.issueCount - zone.resolvedCount;
    const severityLoad = zoneIssues.reduce((sum, issue) => sum + severityScore(issue), 0);
    return unresolved * 2 + severityLoad;
}

export default function IssueHeatmapMap({
    issues,
    zones,
    selectedZone,
    onZoneSelect,
    onIssueSelect,
    constituency,
}: IssueHeatmapMapProps) {
    const [mapInstance, setMapInstance] = useState<MapRef | null>(null);
    const [mapTone, setMapTone] = useState<MapTone>('day');
    const hasInitializedRef = useRef(false);
    const previousSelectedZoneRef = useRef<string | null>(null);
    const previousConstituencyRef = useRef(constituency);
    const suppressNextMapClickRef = useRef(false);

    useEffect(() => {
        const syncTone = () => setMapTone(getLocalMapTone());
        syncTone();
        const intervalId = window.setInterval(syncTone, 60_000);
        return () => window.clearInterval(intervalId);
    }, []);

    const mapToneAccent = useMemo(() => getMapToneAccent(mapTone), [mapTone]);
    const mapToneLabel = useMemo(() => getMapToneLabel(mapTone), [mapTone]);
    const toneOverlayStyle = useMemo(() => {
        switch (mapTone) {
            case 'night':
                return {
                    background:
                        'radial-gradient(circle at 18% 16%, rgba(56,189,248,0.16), transparent 34%), radial-gradient(circle at 82% 78%, rgba(249,115,22,0.18), transparent 28%), linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.38))',
                };
            case 'dusk':
                return {
                    background:
                        'radial-gradient(circle at 22% 14%, rgba(251,146,60,0.18), transparent 34%), radial-gradient(circle at 84% 74%, rgba(129,140,248,0.14), transparent 28%), linear-gradient(180deg, rgba(30,41,59,0.04), rgba(30,41,59,0.24))',
                };
            case 'day':
            default:
                return {
                    background:
                        'radial-gradient(circle at 18% 12%, rgba(250,204,21,0.12), transparent 32%), radial-gradient(circle at 82% 78%, rgba(249,115,22,0.1), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0), rgba(255,248,235,0.2))',
                };
        }
    }, [mapTone]);
    const toneBadgeStyle = useMemo(() => {
        switch (mapTone) {
            case 'night':
                return {
                    backgroundColor: 'rgba(8, 15, 31, 0.82)',
                    borderColor: 'rgba(56, 189, 248, 0.24)',
                    boxShadow: '0 18px 45px rgba(2, 6, 23, 0.46)',
                };
            case 'dusk':
                return {
                    backgroundColor: 'rgba(31, 36, 54, 0.76)',
                    borderColor: 'rgba(249, 115, 22, 0.22)',
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.28)',
                };
            case 'day':
            default:
                return {
                    backgroundColor: 'rgba(255, 251, 245, 0.84)',
                    borderColor: 'rgba(217, 119, 6, 0.16)',
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)',
                };
        }
    }, [mapTone]);
    const toneBadgeTextColor = mapTone === 'day' ? '#0f172a' : '#f8fafc';
    const toneBadgeBodyColor = mapTone === 'day' ? '#475569' : '#cbd5e1';

    const weightedIssuePoints = useMemo(() => getWeightedIssuePoints(issues), [issues]);
    const zoneCentroids = useMemo(() => getZoneCentroids(issues), [issues]);
    const issuePositions = useMemo(
        () => issues.flatMap((issue) => {
            const position = getIssuePosition(issue);
            return position ? [position] : [];
        }),
        [issues],
    );
    const overviewBounds = useMemo(() => getPositionsBounds(issuePositions), [issuePositions]);

    const overviewCenter = useMemo(() => {
        if (constituency) return getConstituencyMapCenter(constituency);
        return getMeanPosition(issuePositions) ?? GHANA_CENTER;
    }, [constituency, issuePositions]);

    const sortedZones = useMemo(() => {
        return [...zones].sort((left, right) => zonePressure(right, issues) - zonePressure(left, issues));
    }, [issues, zones]);

    const zoneIssues = useMemo(() => {
        if (!selectedZone) return [];

        return issues
            .filter((issue) => issue.zone === selectedZone.name)
            .sort((left, right) => {
                const severityDelta = severityScore(right) - severityScore(left);
                if (severityDelta !== 0) return severityDelta;
                return right.upvotes - left.upvotes;
            });
    }, [issues, selectedZone]);

    const zoneOverlayPoints = useMemo(() => {
        return sortedZones.flatMap((zone) => {
            const centroid = zoneCentroids[zone.name];
            if (!centroid) return [];

            const pressure = zonePressure(zone, issues);

            return [{
                color: getPressureColor(pressure),
                isSelected: selectedZone?.id === zone.id,
                issueCount: zone.issueCount,
                position: [centroid.lng, centroid.lat] as [number, number],
                pressure,
                radius: getZoneRadius(zone.issueCount),
                zone,
            }];
        });
    }, [issues, selectedZone?.id, sortedZones, zoneCentroids]);

    const issueOverlayPoints = useMemo(() => {
        if (!selectedZone) return [];

        return zoneIssues.flatMap((issue) => {
            const position = getIssuePosition(issue);
            if (!position) return [];

            return [{
                issueId: issue.id,
                position: [position.lng, position.lat] as [number, number],
                severity: issue.severity,
            }];
        });
    }, [selectedZone, zoneIssues]);

    const initialViewState = useMemo(() => ({
        latitude: overviewCenter.lat,
        longitude: overviewCenter.lng,
        zoom: constituency ? CONSTITUENCY_ZOOM : GHANA_OVERVIEW_ZOOM,
    }), [constituency, overviewCenter]);

    const focusOverview = useCallback((animated: boolean) => {
        if (!mapInstance) return;

        if (constituency) {
            const center = getConstituencyMapCenter(constituency);
            mapInstance.flyTo({
                center: [center.lng, center.lat],
                duration: animated ? 850 : 0,
                zoom: CONSTITUENCY_ZOOM,
            });
            return;
        }

        if (overviewBounds) {
            mapInstance.fitBounds(overviewBounds, {
                duration: animated ? 850 : 0,
                padding: 64,
            });
            return;
        }

        mapInstance.flyTo({
            center: [GHANA_CENTER.lng, GHANA_CENTER.lat],
            duration: animated ? 850 : 0,
            zoom: GHANA_OVERVIEW_ZOOM,
        });
    }, [constituency, mapInstance, overviewBounds]);

    useEffect(() => {
        if (!mapInstance) return;

        if (!hasInitializedRef.current) {
            focusOverview(false);
            hasInitializedRef.current = true;
            previousConstituencyRef.current = constituency;
            return;
        }

        if (!selectedZone && previousConstituencyRef.current !== constituency) {
            focusOverview(true);
            previousConstituencyRef.current = constituency;
        }
    }, [constituency, focusOverview, mapInstance, selectedZone]);

    useEffect(() => {
        if (!mapInstance) return;

        const nextZoneName = selectedZone?.name ?? null;
        if (previousSelectedZoneRef.current === nextZoneName) return;

        if (nextZoneName) {
            const centroid = zoneCentroids[nextZoneName];
            if (centroid) {
                mapInstance.flyTo({
                    center: [centroid.lng, centroid.lat],
                    duration: 800,
                    zoom: ZONE_FOCUS_ZOOM,
                });
            }
        } else if (previousSelectedZoneRef.current) {
            focusOverview(true);
        }

        previousSelectedZoneRef.current = nextZoneName;
    }, [focusOverview, mapInstance, selectedZone?.name, zoneCentroids]);

    const handleMapRef = useCallback((instance: MapRef | null) => {
        setMapInstance(instance);
    }, []);

    const handleZoneToggle = useCallback((zone: ZoneData) => {
        const isSelected = selectedZone?.id === zone.id;
        onZoneSelect(isSelected ? null : zone);
    }, [onZoneSelect, selectedZone?.id]);

    const deckLayers = useMemo(() => {
        const layers = [];
        const contourConfig = getContourConfig(mapTone);
        const zoneFillAlpha = mapTone === 'night' ? 86 : mapTone === 'dusk' ? 78 : 66;
        const zoneFieldAlpha = mapTone === 'night' ? 54 : mapTone === 'dusk' ? 48 : 40;
        const issueGlowAlpha = mapTone === 'night' ? 108 : 90;

        if (weightedIssuePoints.length > 0) {
            layers.push(
                new ContourLayer({
                    cellSize: constituency ? 110 : 156,
                    contours: contourConfig.contours,
                    data: weightedIssuePoints,
                    getPosition: (point) => point.position,
                    getWeight: (point) => point.weight * contourConfig.weightScale,
                    id: 'govlens-issue-contours',
                    pickable: false,
                    zOffset: 0.002,
                }),
            );

            layers.push(
                new HeatmapLayer({
                    colorRange: HEATMAP_COLORS[mapTone],
                    data: weightedIssuePoints,
                    getPosition: (point) => point.position,
                    getWeight: (point) => point.weight * contourConfig.weightScale,
                    id: 'govlens-issue-heatmap',
                    intensity: mapTone === 'night' ? 1.34 : mapTone === 'dusk' ? 1.2 : 1.08,
                    opacity: 1,
                    radiusPixels: constituency ? contourConfig.radiusPixels : contourConfig.radiusPixels - 8,
                    threshold: 0,
                }),
            );
        }

        if (zoneOverlayPoints.length > 0) {
            layers.push(
                new ScatterplotLayer({
                    data: zoneOverlayPoints,
                    filled: true,
                    getFillColor: (point: ZoneOverlayPoint) => withAlpha(
                        point.color,
                        point.isSelected ? zoneFillAlpha + 26 : zoneFieldAlpha,
                    ),
                    getPosition: (point: ZoneOverlayPoint) => point.position,
                    getRadius: (point: ZoneOverlayPoint) => (
                        point.radius + point.pressure * 2.6 + (point.isSelected ? 34 : 22)
                    ),
                    id: 'govlens-zone-fields',
                    opacity: 1,
                    pickable: false,
                    radiusUnits: 'pixels',
                    stroked: false,
                }),
            );

            layers.push(
                new ScatterplotLayer({
                    data: zoneOverlayPoints,
                    filled: true,
                    getFillColor: (point: ZoneOverlayPoint) => withAlpha(
                        point.color,
                        point.isSelected ? zoneFillAlpha + 48 : zoneFillAlpha,
                    ),
                    getPosition: (point: ZoneOverlayPoint) => point.position,
                    getRadius: (point: ZoneOverlayPoint) => point.radius + (point.isSelected ? 14 : 9),
                    id: 'govlens-zone-auras',
                    opacity: 1,
                    pickable: false,
                    radiusUnits: 'pixels',
                    stroked: false,
                }),
            );

            layers.push(
                new ScatterplotLayer({
                    data: zoneOverlayPoints,
                    filled: true,
                    getFillColor: () => getZoneCoreFill(mapTone),
                    getLineColor: (point: ZoneOverlayPoint) => withAlpha(
                        point.color,
                        point.isSelected ? 255 : 224,
                    ),
                    getLineWidth: (point: ZoneOverlayPoint) => (point.isSelected ? 4.2 : 2.8),
                    getPosition: (point: ZoneOverlayPoint) => point.position,
                    getRadius: (point: ZoneOverlayPoint) => point.radius,
                    id: 'govlens-zone-targets',
                    lineWidthUnits: 'pixels',
                    onClick: (info, event) => {
                        if (!info.object) return;
                        suppressNextMapClickRef.current = true;
                        stopDeckEvent(event);
                        handleZoneToggle((info.object as ZoneOverlayPoint).zone);
                    },
                    pickable: true,
                    radiusUnits: 'pixels',
                    stroked: true,
                }),
            );

            layers.push(
                new TextLayer({
                    billboard: true,
                    data: zoneOverlayPoints,
                    fontFamily: 'Georgia, serif',
                    getAlignmentBaseline: 'center',
                    getColor: (point: ZoneOverlayPoint) => getLabelColor(mapTone, point.isSelected),
                    getPosition: (point: ZoneOverlayPoint) => point.position,
                    getSize: (point: ZoneOverlayPoint) => (point.isSelected ? 19 : 16),
                    getText: (point: ZoneOverlayPoint) => `${point.issueCount}`,
                    getTextAnchor: 'middle',
                    id: 'govlens-zone-counts',
                    pickable: false,
                    sizeUnits: 'pixels',
                }),
            );
        }

        if (issueOverlayPoints.length > 0) {
            layers.push(
                new ScatterplotLayer({
                    data: issueOverlayPoints,
                    filled: true,
                    getFillColor: (point: IssueOverlayPoint) => withAlpha(
                        getIssueSeverityColor(point.severity),
                        issueGlowAlpha,
                    ),
                    getPosition: (point: IssueOverlayPoint) => point.position,
                    getRadius: () => (mapTone === 'night' ? 16 : 13),
                    id: 'govlens-zone-issue-glow',
                    pickable: false,
                    radiusUnits: 'pixels',
                    stroked: false,
                }),
            );

            layers.push(
                new ScatterplotLayer({
                    data: issueOverlayPoints,
                    filled: true,
                    getFillColor: (point: IssueOverlayPoint) => withAlpha(
                        getIssueSeverityColor(point.severity),
                        238,
                    ),
                    getLineColor: () => getIssueStrokeColor(mapTone),
                    getLineWidth: () => 2.2,
                    getPosition: (point: IssueOverlayPoint) => point.position,
                    getRadius: () => 6,
                    id: 'govlens-zone-issue-points',
                    lineWidthUnits: 'pixels',
                    onClick: (info, event) => {
                        if (!info.object) return;
                        suppressNextMapClickRef.current = true;
                        stopDeckEvent(event);
                        onIssueSelect((info.object as IssueOverlayPoint).issueId);
                    },
                    pickable: true,
                    radiusUnits: 'pixels',
                    stroked: true,
                }),
            );
        }

        return layers;
    }, [
        constituency,
        handleZoneToggle,
        issueOverlayPoints,
        mapTone,
        onIssueSelect,
        weightedIssuePoints,
        zoneOverlayPoints,
    ]);

    const handleMapClick = useCallback((_event: MapLayerMouseEvent) => {
        if (suppressNextMapClickRef.current) {
            suppressNextMapClickRef.current = false;
            return;
        }

        if (selectedZone) {
            onZoneSelect(null);
        }
    }, [onZoneSelect, selectedZone]);

    return (
        <div className="relative">
            <MapLibreMap
                className={
                    mapTone === 'night'
                        ? 'bg-[#0a1020] ring-1 ring-slate-800 shadow-[0_32px_90px_rgba(6,10,24,0.66)]'
                        : mapTone === 'dusk'
                            ? 'bg-[#1f2436] ring-1 ring-slate-700/40 shadow-[0_28px_78px_rgba(31,36,54,0.42)]'
                            : 'bg-[#f6f1e6] ring-1 ring-amber-100 shadow-[0_18px_45px_rgba(15,23,42,0.14)]'
                }
                height={500}
                initialViewState={initialViewState}
                mapTone={mapTone}
                onClick={handleMapClick}
                ref={handleMapRef}
                showNavigation
                showScale
            >
                <DeckOverlay layers={deckLayers} map={mapInstance} />
            </MapLibreMap>

            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-lg transition-all duration-700"
                style={toneOverlayStyle}
            />

            <div
                className="pointer-events-none absolute left-4 top-4 z-10 max-w-[260px] rounded-2xl border px-4 py-3 backdrop-blur-md transition-all duration-700"
                style={toneBadgeStyle}
            >
                <p
                    className="text-[10px] font-mono uppercase tracking-[0.26em]"
                    style={{ color: toneBadgeBodyColor }}
                >
                    Local map mode
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                            backgroundColor: mapToneAccent,
                            boxShadow: `0 0 0 6px rgba(${hexToRgb(mapToneAccent).join(', ')}, 0.12)`,
                        }}
                    />
                    <span className="font-display text-lg font-semibold" style={{ color: toneBadgeTextColor }}>
                        {mapToneLabel}
                    </span>
                </div>
                <p className="mt-1 text-xs leading-5" style={{ color: toneBadgeBodyColor }}>
                    {MAP_TONE_DETAILS[mapTone]}
                </p>
            </div>
        </div>
    );
}
