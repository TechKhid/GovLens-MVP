'use client';

import { APILoadingStatus, APIProvider, useApiLoadingStatus } from '@vis.gl/react-google-maps';
import { type ReactNode, useState } from 'react';
import { getGoogleMapsClientConfig, getGoogleMapsConfigMessage, type GoogleMapsClientConfig } from '@/lib/google-maps';

interface GoogleMapsContainerProps {
    children: (config: GoogleMapsClientConfig) => ReactNode;
    className?: string;
    compact?: boolean;
    height: number;
    loadingLabel: string;
}

function GoogleMapsFallback({
    compact = false,
    height,
    message,
}: {
    compact?: boolean;
    height: number;
    message: string;
}) {
    return (
        <div
            className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-background px-4 text-center"
            style={{ height: `${height}px` }}
        >
            <div className="max-w-sm">
                <p className="text-sm font-body font-medium text-primary-text">
                    {compact ? 'Map unavailable' : 'Google Maps is unavailable'}
                </p>
                <p className="mt-2 text-xs leading-6 text-muted-text font-body">{message}</p>
            </div>
        </div>
    );
}

function GoogleMapsLoading({
    height,
    loadingLabel,
}: {
    height: number;
    loadingLabel: string;
}) {
    return (
        <div
            className="flex items-center justify-center rounded-2xl bg-background"
            style={{ height: `${height}px` }}
        >
            <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary-text border-t-transparent" />
                <span className="text-sm text-muted-text font-body">{loadingLabel}</span>
            </div>
        </div>
    );
}

function GoogleMapsStatusGate({
    children,
    compact = false,
    errorMessage,
    height,
    loadingLabel,
}: {
    children: ReactNode;
    compact?: boolean;
    errorMessage: string | null;
    height: number;
    loadingLabel: string;
}) {
    const status = useApiLoadingStatus();

    if (status === APILoadingStatus.NOT_LOADED || status === APILoadingStatus.LOADING) {
        return <GoogleMapsLoading height={height} loadingLabel={loadingLabel} />;
    }

    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
        return (
            <GoogleMapsFallback
                compact={compact}
                height={height}
                message={errorMessage ?? 'Check the browser API key, map ID, referrer restrictions, and billing.'}
            />
        );
    }

    return <>{children}</>;
}

export default function GoogleMapsContainer({
    children,
    className,
    compact = false,
    height,
    loadingLabel,
}: GoogleMapsContainerProps) {
    const config = getGoogleMapsClientConfig();
    const [loadError, setLoadError] = useState<string | null>(null);

    if (!config.isConfigured) {
        return (
            <GoogleMapsFallback
                compact={compact}
                height={height}
                message={getGoogleMapsConfigMessage()}
            />
        );
    }

    return (
        <div className={className}>
            <APIProvider
                apiKey={config.apiKey}
                libraries={['marker', 'places']}
                language="en"
                region="GH"
                version="weekly"
                onError={(error) => {
                    setLoadError(error instanceof Error ? error.message : 'Google Maps failed to load.');
                }}
            >
                <GoogleMapsStatusGate
                    compact={compact}
                    errorMessage={loadError}
                    height={height}
                    loadingLabel={loadingLabel}
                >
                    {children(config)}
                </GoogleMapsStatusGate>
            </APIProvider>
        </div>
    );
}
