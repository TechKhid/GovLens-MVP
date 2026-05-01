'use client';

import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import { GHANA_BOUNDS, GHANA_COUNTRY_CODE, type GooglePlaceSelection } from '@/lib/google-maps';

interface GooglePlaceSearchProps {
    bias: google.maps.places.LocationBias;
    className?: string;
    onPlaceSelect: (place: GooglePlaceSelection) => void;
    origin: google.maps.LatLngLiteral;
    placeholder: string;
}

type PlacePredictionSelectEvent = Event & {
    placePrediction: google.maps.places.PlacePrediction;
};

function toViewportLiteral(bounds: google.maps.LatLngBounds | null | undefined): google.maps.LatLngBoundsLiteral | null {
    if (!bounds) return null;

    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    return {
        east: northEast.lng(),
        north: northEast.lat(),
        south: southWest.lat(),
        west: southWest.lng(),
    };
}

export default function GooglePlaceSearch({
    bias,
    className,
    onPlaceSelect,
    origin,
    placeholder,
}: GooglePlaceSearchProps) {
    const placesLibrary = useMapsLibrary('places');
    const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

    useEffect(() => {
        const element = autocompleteRef.current;
        if (!element) return;

        element.includedRegionCodes = [GHANA_COUNTRY_CODE];
        element.locationBias = bias;
        element.locationRestriction = GHANA_BOUNDS;
        element.origin = origin;
        element.requestedLanguage = 'en';
        element.requestedRegion = GHANA_COUNTRY_CODE;
        element.setAttribute('placeholder', placeholder);
    }, [bias, origin, placeholder]);

    useEffect(() => {
        const element = autocompleteRef.current;
        if (!placesLibrary || !element) return;

        const handleSelect = async (rawEvent: Event) => {
            const event = rawEvent as PlacePredictionSelectEvent;
            const place = event.placePrediction.toPlace();

            await place.fetchFields({
                fields: ['displayName', 'formattedAddress', 'id', 'location', 'viewport'],
            });

            if (!place.location) return;

            onPlaceSelect({
                displayName: place.displayName ?? '',
                formattedAddress: place.formattedAddress ?? '',
                location: {
                    lat: place.location.lat(),
                    lng: place.location.lng(),
                },
                placeId: place.id ?? '',
                viewport: toViewportLiteral(place.viewport),
            });
        };

        element.addEventListener('gmp-select', handleSelect as EventListener);

        return () => {
            element.removeEventListener('gmp-select', handleSelect as EventListener);
        };
    }, [onPlaceSelect, placesLibrary]);

    return (
        <div className={`map-search-shell rounded-2xl border border-border bg-white/95 px-3 py-2 shadow-[0_12px_30px_rgba(17,24,39,0.08)] backdrop-blur ${className ?? ''}`}>
            <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.24em] text-muted-text">
                Search Ghana
            </p>
            {!placesLibrary ? (
                <div className="h-[40px] animate-pulse rounded-xl bg-background" />
            ) : (
                <gmp-place-autocomplete
                    ref={(node) => {
                        autocompleteRef.current = node;
                    }}
                    className="block w-full"
                />
            )}
        </div>
    );
}
