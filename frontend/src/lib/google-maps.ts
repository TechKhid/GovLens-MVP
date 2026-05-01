import { getConstituencyCenter } from '@/lib/constituency-centers';
import type { Issue, Severity } from '@/lib/mockData';

export interface GoogleMapsClientConfig {
    apiKey: string;
    isConfigured: boolean;
    mapId: string;
}

export interface GooglePlaceSelection {
    displayName: string;
    formattedAddress: string;
    location: google.maps.LatLngLiteral;
    placeId: string;
    viewport: google.maps.LatLngBoundsLiteral | null;
}

export interface WeightedIssuePoint {
    id: string;
    issueId: string;
    position: [number, number];
    severity: Severity;
    weight: number;
    zone: string;
}

export const GHANA_CENTER: google.maps.LatLngLiteral = { lat: 7.9465, lng: -1.0232 };
export const GHANA_BOUNDS: google.maps.LatLngBoundsLiteral = {
    east: 1.1992,
    north: 11.1749,
    south: 4.7388,
    west: -3.2608,
};
export const GHANA_COUNTRY_CODE = 'gh';
export const GHANA_OVERVIEW_ZOOM = 7;
export const CONSTITUENCY_ZOOM = 12;
export const PIN_MAP_ZOOM = 15;
export const ISSUE_DETAIL_ZOOM = 17;

export function getGoogleMapsClientConfig(): GoogleMapsClientConfig {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
    const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() ?? '';

    return {
        apiKey,
        isConfigured: Boolean(apiKey && mapId),
        mapId,
    };
}

export function getGoogleMapsConfigMessage(): string {
    return 'Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAP_ID to enable maps.';
}

export function getConstituencyMapCenter(constituency: string): google.maps.LatLngLiteral {
    const center = getConstituencyCenter(constituency);
    if (!center) return GHANA_CENTER;

    return { lat: center.lat, lng: center.lng };
}

export function getIssuePosition(issue: Issue): google.maps.LatLngLiteral | null {
    const { lat, lng } = issue.location.gps;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;

    return { lat, lng };
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

export function buildViewportBias(
    bounds: google.maps.LatLngBoundsLiteral | null,
    fallbackCenter: google.maps.LatLngLiteral,
): google.maps.places.LocationBias {
    if (bounds) return bounds;

    return {
        center: fallbackCenter,
        radius: 25000,
    } satisfies google.maps.CircleLiteral;
}

export function fitMapToPlace(map: google.maps.Map, place: GooglePlaceSelection): void {
    if (place.viewport) {
        map.fitBounds(place.viewport, 72);
        return;
    }

    map.panTo(place.location);
    map.setZoom(ISSUE_DETAIL_ZOOM);
}

export function toBoundsLiteral(
    bounds: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null | undefined,
): google.maps.LatLngBoundsLiteral | null {
    if (!bounds) return null;

    if ('getNorthEast' in bounds) {
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();

        return {
            east: northEast.lng(),
            north: northEast.lat(),
            south: southWest.lat(),
            west: southWest.lng(),
        };
    }

    return bounds;
}
