'use client';

import { forwardRef, useMemo, type ReactNode } from 'react';
import Map, {
    NavigationControl,
    ScaleControl,
    type MapProps,
    type MapRef,
} from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    getMapToneSurface,
    getOpenStreetMapStyle,
    type MapTone,
} from './map-style';

interface MapLibreMapProps extends Omit<MapProps, 'children' | 'mapLib' | 'mapStyle' | 'style'> {
    children?: ReactNode;
    className?: string;
    height?: number | string;
    mapTone?: MapTone;
    showNavigation?: boolean;
    showScale?: boolean;
}

const MapLibreMap = forwardRef<MapRef, MapLibreMapProps>(function MapLibreMap(
    {
        attributionControl,
        children,
        className,
        height = 500,
        mapTone = 'day',
        showNavigation = true,
        showScale = false,
        ...props
    },
    ref,
) {
    const resolvedHeight = typeof height === 'number' ? `${height}px` : height;
    const mapStyle = useMemo(() => getOpenStreetMapStyle(mapTone), [mapTone]);
    const surfaceColor = useMemo(() => getMapToneSurface(mapTone), [mapTone]);

    return (
        <div
            className={`w-full overflow-hidden rounded-lg border border-border transition-colors duration-700 ${className ?? ''}`}
            style={{ backgroundColor: surfaceColor, height: resolvedHeight }}
        >
            <Map
                {...props}
                attributionControl={attributionControl ?? undefined}
                mapLib={maplibregl}
                mapStyle={mapStyle}
                ref={ref}
                reuseMaps
                style={{ width: '100%', height: '100%' }}
            >
                {showNavigation ? <NavigationControl position="top-right" /> : null}
                {showScale ? <ScaleControl position="bottom-left" /> : null}
                {children}
            </Map>
        </div>
    );
});

export default MapLibreMap;
