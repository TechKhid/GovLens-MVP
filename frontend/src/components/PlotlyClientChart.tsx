'use client';

import { useEffect, useRef, useState } from 'react';

type PlotlyDatum = Record<string, unknown>;
type PlotlyLayout = Record<string, unknown>;
type PlotlyConfig = Record<string, unknown>;

type PlotlyPoint = {
    curveNumber?: number;
    customdata?: unknown;
    label?: string;
    pointNumber?: number;
    x?: number | string;
    y?: number | string;
};

type PlotlyGraphDiv = HTMLDivElement & {
    on?: (event: string, handler: (event: { points?: PlotlyPoint[] }) => void) => void;
    removeAllListeners?: (event?: string) => void;
};

interface PlotlyClientChartProps {
    className?: string;
    config?: PlotlyConfig;
    data: PlotlyDatum[];
    layout?: PlotlyLayout;
    onPointClick?: (point: PlotlyPoint) => void;
}

export default function PlotlyClientChart({
    className,
    config,
    data,
    layout,
    onPointClick,
}: PlotlyClientChartProps) {
    const chartRef = useRef<PlotlyGraphDiv | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let cleanupResize: (() => void) | undefined;
        let Plotly: any;

        async function renderChart() {
            if (!chartRef.current) return;

            setLoadError(null);
            setIsReady(false);

            try {
                const plotlyModule = await import('plotly.js-dist-min');
                Plotly = plotlyModule.default ?? plotlyModule;

                if (cancelled || !chartRef.current) return;

                await Plotly.react(chartRef.current, data, layout ?? {}, {
                    responsive: true,
                    displaylogo: false,
                    ...config,
                });

                if (cancelled || !chartRef.current) return;

                chartRef.current.removeAllListeners?.('plotly_click');
                if (onPointClick) {
                    chartRef.current.on?.('plotly_click', (event) => {
                        const point = event.points?.[0];
                        if (point) onPointClick(point);
                    });
                }

                const handleResize = () => {
                    if (chartRef.current) {
                        Plotly.Plots.resize(chartRef.current);
                    }
                };

                window.addEventListener('resize', handleResize);
                setIsReady(true);

                // Let the chart settle in its final visible layout before the first hover interaction.
                requestAnimationFrame(() => {
                    if (!cancelled) {
                        handleResize();
                    }
                });

                cleanupResize = () => window.removeEventListener('resize', handleResize);
            } catch (error) {
                if (cancelled) return;
                console.error('Failed to load Plotly chart:', error);
                setLoadError(error instanceof Error ? error.message : 'Chart unavailable');
                setIsReady(false);
            }
        }

        void renderChart();
        const chartNode = chartRef.current;

        return () => {
            cancelled = true;
            cleanupResize?.();
            chartNode?.removeAllListeners?.('plotly_click');
            if (Plotly && chartNode) {
                Plotly.purge(chartNode);
            }
        };
    }, [config, data, layout, onPointClick]);

    return (
        <div className={`relative min-h-[220px] ${className ?? ''}`}>
            {loadError ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded border border-dashed border-border bg-background px-4 text-center">
                    <p className="text-sm font-body text-muted-text">
                        Interactive chart unavailable in this session.
                    </p>
                </div>
            ) : !isReady && (
                <div className="absolute inset-0 z-10 rounded bg-background animate-pulse" />
            )}
            <div
                ref={chartRef}
                className={`h-full w-full transition-opacity ${isReady ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    );
}
