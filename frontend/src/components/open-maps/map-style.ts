import type { StyleSpecification } from 'maplibre-gl';

export type MapTone = 'day' | 'dusk' | 'night';

interface MapToneDefinition {
    accent: string;
    background: string;
    label: string;
    rasterBrightnessMax: number;
    rasterBrightnessMin: number;
    rasterContrast: number;
    rasterHueRotate: number;
    rasterOpacity: number;
    rasterSaturation: number;
}

const MAP_TONES: Record<MapTone, MapToneDefinition> = {
    day: {
        accent: '#d97706',
        background: '#f6f1e6',
        label: 'Day shift',
        rasterBrightnessMax: 0.96,
        rasterBrightnessMin: 0.3,
        rasterContrast: 0.08,
        rasterHueRotate: 0,
        rasterOpacity: 0.92,
        rasterSaturation: -0.58,
    },
    dusk: {
        accent: '#f97316',
        background: '#1f2436',
        label: 'Dusk patrol',
        rasterBrightnessMax: 0.64,
        rasterBrightnessMin: 0.08,
        rasterContrast: 0.24,
        rasterHueRotate: 26,
        rasterOpacity: 0.9,
        rasterSaturation: -0.18,
    },
    night: {
        accent: '#f59e0b',
        background: '#0a1020',
        label: 'Night watch',
        rasterBrightnessMax: 0.44,
        rasterBrightnessMin: 0.04,
        rasterContrast: 0.38,
        rasterHueRotate: 188,
        rasterOpacity: 0.88,
        rasterSaturation: -0.42,
    },
};

export function getMapToneForHour(hour: number): MapTone {
    if (hour >= 6 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
}

export function getLocalMapTone(date = new Date()): MapTone {
    return getMapToneForHour(date.getHours());
}

export function getMapToneLabel(tone: MapTone): string {
    return MAP_TONES[tone].label;
}

export function getMapToneSurface(tone: MapTone): string {
    return MAP_TONES[tone].background;
}

export function getMapToneAccent(tone: MapTone): string {
    return MAP_TONES[tone].accent;
}

export function getOpenStreetMapStyle(tone: MapTone): StyleSpecification {
    const theme = MAP_TONES[tone];

    return {
        version: 8,
        sources: {
            'openstreetmap-raster': {
                type: 'raster',
                attribution: '&copy; OpenStreetMap contributors',
                tiles: [
                    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
                ],
                tileSize: 256,
                maxzoom: 19,
            },
        },
        layers: [
            {
                id: 'openstreetmap-background',
                type: 'background',
                paint: {
                    'background-color': theme.background,
                },
            },
            {
                id: 'openstreetmap-raster',
                type: 'raster',
                source: 'openstreetmap-raster',
                minzoom: 0,
                maxzoom: 22,
                paint: {
                    'raster-brightness-max': theme.rasterBrightnessMax,
                    'raster-brightness-min': theme.rasterBrightnessMin,
                    'raster-contrast': theme.rasterContrast,
                    'raster-fade-duration': 0,
                    'raster-hue-rotate': theme.rasterHueRotate,
                    'raster-opacity': theme.rasterOpacity,
                    'raster-saturation': theme.rasterSaturation,
                },
            },
        ],
    };
}

export const OPEN_STREET_MAP_STYLE = getOpenStreetMapStyle('day');
