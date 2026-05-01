import { getConstituencyCenter } from '@/lib/constituency-centers';
import type { Issue, Severity } from '@/lib/mockData';

export interface MapPoint {
    lat: number;
    lng: number;
}

export interface WeightedIssuePoint {
    id: string;
    issueId: string;
    position: [number, number];
    severity: Severity;
    weight: number;
    zone: string;
}

export const GHANA_CENTER: MapPoint = { lat: 7.9465, lng: -1.0232 };
export const GHANA_OVERVIEW_ZOOM = 7;
export const CONSTITUENCY_ZOOM = 12;
export const PIN_MAP_ZOOM = 15;
export const MINI_MAP_ZOOM = 16;
export const ZONE_FOCUS_ZOOM = 15;

export function hasMeaningfulCoordinates(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

export function getConstituencyMapCenter(constituency: string): MapPoint {
    const center = getConstituencyCenter(constituency);
    if (!center) return GHANA_CENTER;

    return { lat: center.lat, lng: center.lng };
}

export function getIssuePosition(issue: Issue): MapPoint | null {
    const { lat, lng } = issue.location.gps;
    if (!hasMeaningfulCoordinates(lat, lng)) return null;

    return { lat, lng };
}

export function getSeverityWeight(severity: Severity): number {
    switch (severity) {
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

export function getWeightedIssuePoints(issues: Issue[]): WeightedIssuePoint[] {
    return issues.flatMap((issue) => {
        const position = getIssuePosition(issue);
        if (!position) return [];

        return [{
            id: issue.id,
            issueId: issue.id,
            position: [position.lng, position.lat] as [number, number],
            severity: issue.severity,
            weight: getSeverityWeight(issue.severity),
            zone: issue.zone,
        }];
    });
}

export function getZoneCentroids(issues: Issue[]): Record<string, MapPoint> {
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

    const centroids: Record<string, MapPoint> = {};
    accumulator.forEach((entry, zone) => {
        centroids[zone] = {
            lat: entry.lat / entry.count,
            lng: entry.lng / entry.count,
        };
    });

    return centroids;
}

export function getMeanPosition(positions: MapPoint[]): MapPoint | null {
    if (positions.length === 0) return null;

    const total = positions.reduce(
        (sum, position) => ({
            lat: sum.lat + position.lat,
            lng: sum.lng + position.lng,
        }),
        { lat: 0, lng: 0 },
    );

    return {
        lat: total.lat / positions.length,
        lng: total.lng / positions.length,
    };
}

export function getPositionsBounds(
    positions: MapPoint[],
): [[number, number], [number, number]] | null {
    if (positions.length === 0) return null;

    let north = positions[0].lat;
    let south = positions[0].lat;
    let east = positions[0].lng;
    let west = positions[0].lng;

    positions.forEach((position) => {
        north = Math.max(north, position.lat);
        south = Math.min(south, position.lat);
        east = Math.max(east, position.lng);
        west = Math.min(west, position.lng);
    });

    return [[west, south], [east, north]];
}
