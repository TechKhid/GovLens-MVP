'use client';

import { AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import { useMemo } from 'react';
import GoogleMapsContainer from '@/components/google-maps/GoogleMapsContainer';
import { GHANA_CENTER, ISSUE_DETAIL_ZOOM } from '@/lib/google-maps';

interface GoogleLocationMiniMapProps {
    color: string;
    height?: number;
    lat: number;
    lng: number;
}

export default function GoogleLocationMiniMap({
    color,
    height = 140,
    lat,
    lng,
}: GoogleLocationMiniMapProps) {
    const hasPosition = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    const position = useMemo(
        () => (hasPosition ? { lat, lng } : GHANA_CENTER),
        [hasPosition, lat, lng],
    );

    if (!hasPosition) {
        return (
            <div
                className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-background px-4 text-center"
                style={{ height: `${height}px` }}
            >
                <p className="text-xs leading-6 text-muted-text font-body">
                    Coordinates are unavailable for this issue.
                </p>
            </div>
        );
    }

    return (
        <GoogleMapsContainer
            className="w-full"
            compact
            height={height}
            loadingLabel="Loading location map..."
        >
            {(config) => (
                <Map
                    center={position}
                    clickableIcons={false}
                    className="h-full w-full"
                    disableDefaultUI
                    gestureHandling="none"
                    keyboardShortcuts={false}
                    mapId={config.mapId}
                    reuseMaps
                    zoom={ISSUE_DETAIL_ZOOM}
                >
                    <AdvancedMarker
                        position={position}
                        title="Reported issue location"
                    >
                        <div
                            className="h-4 w-4 rounded-full border-[3px] border-white shadow-[0_8px_18px_rgba(17,24,39,0.2)]"
                            style={{ backgroundColor: color }}
                        />
                    </AdvancedMarker>
                </Map>
            )}
        </GoogleMapsContainer>
    );
}
