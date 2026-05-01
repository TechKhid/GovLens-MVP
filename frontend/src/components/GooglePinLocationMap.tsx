'use client';

import type { MapMouseEvent as GoogleMapClickEvent } from '@vis.gl/react-google-maps';
import { AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GoogleMapsContainer from '@/components/google-maps/GoogleMapsContainer';
import GooglePlaceSearch from '@/components/google-maps/GooglePlaceSearch';
import {
    buildViewportBias,
    fitMapToPlace,
    getConstituencyMapCenter,
    PIN_MAP_ZOOM,
    type GooglePlaceSelection,
} from '@/lib/google-maps';

interface GooglePinLocationMapProps {
    constituency?: string;
    height?: number;
    lat: number;
    lng: number;
    onPinChange: (lat: number, lng: number) => void;
    onPlaceSelect?: (place: GooglePlaceSelection) => void;
}

const PIN_MAP_INSTANCE_ID = 'report-pin-map';

function PinMapViewportSync({
    position,
}: {
    position: google.maps.LatLngLiteral;
}) {
    const map = useMap();
    const previousPositionRef = useRef<google.maps.LatLngLiteral | null>(null);

    useEffect(() => {
        if (!map) return;

        const previousPosition = previousPositionRef.current;
        if (previousPosition && previousPosition.lat === position.lat && previousPosition.lng === position.lng) {
            return;
        }

        previousPositionRef.current = position;
        map.panTo(position);
        if ((map.getZoom() ?? 0) < PIN_MAP_ZOOM) {
            map.setZoom(PIN_MAP_ZOOM);
        }
    }, [map, position]);

    return null;
}

function GooglePinLocationMapInner({
    constituency = '',
    lat,
    lng,
    mapId,
    onPinChange,
    onPlaceSelect,
}: Omit<GooglePinLocationMapProps, 'height'> & {
    mapId: string;
}) {
    const map = useMap(PIN_MAP_INSTANCE_ID);
    const defaultCenter = useMemo(
        () => getConstituencyMapCenter(constituency),
        [constituency],
    );
    const [searchBias, setSearchBias] = useState<google.maps.LatLngBoundsLiteral | null>(null);
    const [searchOrigin, setSearchOrigin] = useState(defaultCenter);
    const position = useMemo(
        () => (Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : defaultCenter),
        [defaultCenter, lat, lng],
    );

    useEffect(() => {
        setSearchOrigin(defaultCenter);
    }, [defaultCenter]);

    const handleMapClick = useCallback((event: GoogleMapClickEvent) => {
        const nextPosition = event.detail.latLng;
        if (!nextPosition) return;

        onPinChange(nextPosition.lat, nextPosition.lng);
    }, [onPinChange]);

    const handleMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;

        onPinChange(event.latLng.lat(), event.latLng.lng());
    }, [onPinChange]);

    const handleSearchSelect = useCallback((place: GooglePlaceSelection) => {
        if (!map) return;

        fitMapToPlace(map, place);
        onPinChange(place.location.lat, place.location.lng);
        onPlaceSelect?.(place);
    }, [map, onPinChange, onPlaceSelect]);

    return (
        <div className="relative overflow-hidden rounded-lg border border-border">
            <div className="absolute left-3 right-3 top-3 z-10 md:left-4 md:right-auto md:w-[320px]">
                <GooglePlaceSearch
                    bias={buildViewportBias(searchBias, defaultCenter)}
                    onPlaceSelect={handleSearchSelect}
                    origin={searchOrigin}
                    placeholder="Search for an address, landmark, or area in Ghana"
                />
            </div>

            <Map
                id={PIN_MAP_INSTANCE_ID}
                className="h-full w-full"
                clickableIcons={false}
                defaultCenter={defaultCenter}
                defaultZoom={PIN_MAP_ZOOM}
                fullscreenControl={false}
                gestureHandling="greedy"
                mapId={mapId}
                mapTypeControl={false}
                onCameraChanged={(event) => {
                    setSearchOrigin(event.detail.center);
                    setSearchBias(event.detail.bounds);
                }}
                onClick={handleMapClick}
                reuseMaps
                streetViewControl={false}
            >
                <AdvancedMarker
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                    position={position}
                    title="Selected report location"
                >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-status-critical shadow-[0_10px_22px_rgba(17,24,39,0.2)]" />
                </AdvancedMarker>

                <PinMapViewportSync position={position} />
            </Map>
        </div>
    );
}

export default function GooglePinLocationMap({
    height = 180,
    ...props
}: GooglePinLocationMapProps) {
    return (
        <GoogleMapsContainer
            className="w-full"
            height={height}
            loadingLabel="Loading map..."
        >
            {(config) => (
                <GooglePinLocationMapInner
                    {...props}
                    mapId={config.mapId}
                />
            )}
        </GoogleMapsContainer>
    );
}
