'use client';

import { useEffect, useRef } from 'react';
import type { LayersList } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { MapRef } from 'react-map-gl/maplibre';

interface DeckOverlayProps {
    layers: LayersList;
    map: MapRef | null;
}

export default function DeckOverlay({ layers, map }: DeckOverlayProps) {
    const overlayRef = useRef<MapboxOverlay | null>(null);

    useEffect(() => {
        const mapInstance = map?.getMap();
        if (!mapInstance) return undefined;

        if (!overlayRef.current) {
            overlayRef.current = new MapboxOverlay({
                interleaved: false,
                layers: [],
            });
            mapInstance.addControl(overlayRef.current);
        }

        return () => {
            if (overlayRef.current) {
                mapInstance.removeControl(overlayRef.current);
                overlayRef.current.finalize();
                overlayRef.current = null;
            }
        };
    }, [map]);

    useEffect(() => {
        overlayRef.current?.setProps({
            interleaved: false,
            layers,
        });
    }, [layers]);

    return null;
}
