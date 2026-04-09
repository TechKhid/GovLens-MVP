'use client';

import {
    SECTORS, SECTOR_COLORS, SEVERITY_COLORS,
    Sector,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/context/RoleContext';
import { useMemo, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { matchesConstituencyZone } from '@/lib/geo-scope';

// ── ML data types ─────────────────────────────────────────────────────────────

interface ForecastPoint {
    date: string;
    predicted_count: number;
    lower: number;
    upper: number;
}

interface InsightsData {
    slope: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    forecast: ForecastPoint[];
    historical: { date: string; count: number }[];
    model: string;
}

interface SentimentData {
    average_compound: number;
    severity_distribution: { low: number; medium: number; high: number };
    overall_severity: 'low' | 'medium' | 'high';
    sample_size: number;
}

interface TopSector {
    sector: string;
    count: number;
    prior_count: number;
    pct_change: number;
    trending: 'up' | 'down' | 'stable';
}

interface SectorInsightsData {
    top_sectors: TopSector[];
    sentiment_by_sector: Record<string, SentimentData>;
}

interface RecurringPattern {
    zone: string;
    sector: string;
    count: number;
    severity: 'medium' | 'high' | 'critical';
}

interface TrendPoint {
    period: string;
    avg_days: number;
    count: number;
}

// ── Helper to format trend badge ─────────────────────────────────────────────

function TrendBadge({ trending, pct }: { trending: string; pct: number }) {
    if (trending === 'up') return (
        <span className="text-xs font-mono text-status-critical">↑ {pct}%</span>
    );
    if (trending === 'down') return (
        <span className="text-xs font-mono text-status-resolved">↓ {Math.abs(pct)}%</span>
    );
    return <span className="text-xs font-mono text-muted-text">→ stable</span>;
}

// ── Severity colour helper ────────────────────────────────────────────────────

function severityColor(s: string): string {
    if (s === 'critical') return SEVERITY_COLORS['Critical'];
    if (s === 'high') return SEVERITY_COLORS['High'];
    if (s === 'medium') return SEVERITY_COLORS['Medium'];
    return SEVERITY_COLORS['Low'];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const { issues: allIssues, zones: allZones } = useDataStore();
    const { user } = useAuth();

    // Restrict analytics to the MP's constituency
    const issues = useMemo(() => {
        if (!user || user.role !== 'mp' || !user.constituency) return allIssues;
        return allIssues.filter((i) => matchesConstituencyZone(user.constituency, i.zone));
    }, [allIssues, user]);

    const zones = useMemo(() => {
        if (!user || user.role !== 'mp' || !user.constituency) return allZones;
        return allZones.filter((z) => matchesConstituencyZone(user.constituency, z.name));
    }, [allZones, user]);

    // ── ML data state ────────────────────────────────────────────────────
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [sentiment, setSentiment] = useState<SentimentData | null>(null);
    const [sectorInsights, setSectorInsights] = useState<SectorInsightsData | null>(null);
    const [recurring, setRecurring] = useState<RecurringPattern[]>([]);
    const [responseTrend, setResponseTrend] = useState<TrendPoint[]>([]);
    const [mlLoading, setMlLoading] = useState(true);
    const [mlError, setMlError] = useState(false);

    useEffect(() => {
        const zone = user?.constituency ?? '';
        const withQuery = (path: string, params: Record<string, string>) => {
            const search = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value) search.set(key, value);
            });
            const query = search.toString();
            return query ? `${path}?${query}` : path;
        };

        async function loadML() {
            setMlLoading(true);
            setMlError(false);
            const [ins, sent, sec, rec, trend] = await Promise.allSettled([
                api.get<InsightsData>(withQuery('/ml/insights', { zone, days: '14' })),
                api.get<SentimentData>(withQuery('/ml/sentiment', { zone })),
                api.get<SectorInsightsData>(withQuery('/ml/sector-insights', { zone })),
                api.get<{ patterns: RecurringPattern[] }>(withQuery('/ml/recurring', { zone, threshold: '2' })),
                api.get<{ trend: TrendPoint[] }>(withQuery('/ml/response-trend', { zone })),
            ]);

            if (ins.status === 'fulfilled') setInsights(ins.value);
            if (sent.status === 'fulfilled') setSentiment(sent.value);
            if (sec.status === 'fulfilled') setSectorInsights(sec.value);
            if (rec.status === 'fulfilled') setRecurring(rec.value.patterns ?? []);
            if (trend.status === 'fulfilled') setResponseTrend(trend.value.trend ?? []);

            const coreFailures = [ins, sent, sec].every((result) => result.status === 'rejected');
            setMlError(coreFailures);
            setMlLoading(false);
        }
        loadML();
    }, [user?.constituency]);

    // ── Computed from issues (live DB data) ──────────────────────────────
    const sectorCounts: Record<string, number> = {};
    SECTORS.forEach((s) => {
        sectorCounts[s] = issues.filter((i) => i.sector?.toLowerCase() === s.toLowerCase()).length;
    });
    const maxSectorCount = Math.max(...Object.values(sectorCounts), 1);

    const zonePerformance = zones.map((z) => ({
        name: z.name,
        total: z.issueCount,
        resolved: z.resolvedCount,
        rate: z.issueCount > 0 ? Math.round((z.resolvedCount / z.issueCount) * 100) : 0,
    }));

    // ── AI Insight cards derived from real ML data ────────────────────────
    const insightCards = useMemo(() => {
        const cards: { icon: string; label: string; color: string; text: string }[] = [];

        if (!sectorInsights) return cards;

        // Card 1: top trending sector
        const topSec = sectorInsights.top_sectors.find((s) => s.trending === 'up');
        if (topSec) {
            cards.push({
                icon: '📈',
                label: `${topSec.sector.charAt(0).toUpperCase() + topSec.sector.slice(1)} Issues Rising`,
                color: SEVERITY_COLORS['High'],
                text: `${topSec.sector.charAt(0).toUpperCase() + topSec.sector.slice(1)} issues increased ${topSec.pct_change}% vs the prior period (${topSec.count} vs ${topSec.prior_count} reports). Consider proactive outreach to the responsible agency.`,
            });
        }

        // Card 2: overall sentiment health
        if (sentiment) {
            const label = sentiment.overall_severity === 'high'
                ? 'High Citizen Distress Detected'
                : sentiment.overall_severity === 'medium'
                    ? 'Moderate Community Concern'
                    : 'Community Sentiment Stable';
            const color = sentiment.overall_severity === 'high'
                ? SEVERITY_COLORS['Critical']
                : sentiment.overall_severity === 'medium'
                    ? SEVERITY_COLORS['High']
                    : SEVERITY_COLORS['Low'];
            cards.push({
                icon: sentiment.overall_severity === 'high' ? '⚠️' : sentiment.overall_severity === 'medium' ? '🔶' : '✅',
                label,
                color,
                text: `Analysed ${sentiment.sample_size} issue reports. ${sentiment.severity_distribution.high} high-severity, ${sentiment.severity_distribution.medium} medium, ${sentiment.severity_distribution.low} routine. Average urgency score: ${sentiment.average_compound.toFixed(2)}.`,
            });
        }

        // Card 3: trend direction
        if (insights) {
            const trendLabel = insights.trend === 'increasing'
                ? 'Issue Volume Escalating'
                : insights.trend === 'decreasing'
                    ? 'Issue Volume Declining'
                    : 'Issue Volume Stable';
            const trendColor = insights.trend === 'increasing'
                ? SEVERITY_COLORS['High']
                : insights.trend === 'decreasing'
                    ? SEVERITY_COLORS['Low']
                    : SEVERITY_COLORS['Medium'];
            const next7 = insights.forecast.slice(0, 7).reduce((s, p) => s + p.predicted_count, 0);
            cards.push({
                icon: insights.trend === 'increasing' ? '📊' : insights.trend === 'decreasing' ? '📉' : '📊',
                label: trendLabel,
                color: trendColor,
                text: `${insights.model === 'prophet' ? 'Prophet forecast' : 'Trend model'} projects ~${Math.round(next7)} new issues in the next 7 days (slope: ${insights.slope > 0 ? '+' : ''}${insights.slope}/day). ${insights.trend === 'increasing' ? 'Proactive triage recommended.' : insights.trend === 'decreasing' ? 'Backlog is clearing.' : 'No significant change expected.'}`,
            });
        }

        // Card 4: worst recurring pattern
        if (recurring.length > 0) {
            const worst = recurring[0];
            cards.push({
                icon: '🔁',
                label: `Recurring: ${worst.sector.charAt(0).toUpperCase() + worst.sector.slice(1)} in ${worst.zone}`,
                color: severityColor(worst.severity),
                text: `${worst.count} submissions of ${worst.sector} issues from ${worst.zone} — this pattern suggests a systemic problem needing a structural fix rather than individual case resolution.`,
            });
        }

        return cards;
    }, [sectorInsights, sentiment, insights, recurring]);

    // ── Response trend chart data ─────────────────────────────────────────
    const trendChartData = responseTrend.length > 0 ? responseTrend : null;
    const trendMax = trendChartData ? Math.max(...trendChartData.map((t) => t.avg_days), 1) : 1;

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold">Analytics &amp; Intelligence</h1>
                <p className="text-sm text-muted-text font-body mt-1">
                    Decision support for resource allocation and governance priorities
                    {!mlLoading && !mlError && (
                        <span className="ml-2 text-xs font-mono text-status-resolved">
                            · ML {sectorInsights ? 'live' : 'unavailable'}
                        </span>
                    )}
                </p>
            </div>

            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard label="Total Issues" value={issues.length} color="#111111" />
                <StatCard
                    label="Resolution Rate"
                    value={`${issues.length > 0 ? Math.round((issues.filter((i) => i.status === 'Resolved').length / issues.length) * 100) : 0}%`}
                    color="#2E7D32"
                />
                <StatCard
                    label="Avg Response"
                    value={trendChartData && trendChartData.length > 0
                        ? `${trendChartData[trendChartData.length - 1].avg_days}d`
                        : '—'
                    }
                    color="#F5A623"
                />
                <StatCard
                    label="High Severity"
                    value={sentiment ? sentiment.severity_distribution.high : issues.filter((i) => String(i.severity).toLowerCase() === 'high' || String(i.severity).toLowerCase() === 'critical').length}
                    color="#C62828"
                />
            </div>

            {/* AI Insight Cards */}
            <div className="mb-6">
                <h3 className="section-label mb-3">AI-Generated Insights</h3>
                {mlLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="card p-4 animate-pulse">
                                <div className="h-4 bg-background w-40 rounded mb-2" />
                                <div className="h-3 bg-background w-full rounded mb-1" />
                                <div className="h-3 bg-background w-3/4 rounded" />
                            </div>
                        ))}
                    </div>
                ) : mlError || insightCards.length === 0 ? (
                    <div className="card p-4 text-sm text-muted-text font-body">
                        {mlError
                            ? 'ML sidecar unavailable — insights will appear once the service is reachable.'
                            : 'No insight patterns detected yet — insights appear as issue data accumulates.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {insightCards.map((insight, i) => (
                            <div
                                key={i}
                                className="card p-4"
                                style={{ borderLeftWidth: '3px', borderLeftColor: insight.color }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{insight.icon}</span>
                                    <span
                                        className="text-sm font-body font-semibold"
                                        style={{ color: insight.color }}
                                    >
                                        {insight.label}
                                    </span>
                                </div>
                                <p className="text-sm font-body text-primary-text leading-relaxed">
                                    {insight.text}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sector Distribution — with ML period-over-period change */}
                <div className="card p-5">
                    <h3 className="section-label mb-4">Sector Distribution</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        Where are the most issues concentrated?
                    </p>
                    <div className="space-y-3">
                        {(sectorInsights?.top_sectors ?? SECTORS.map((s) => ({
                            sector: s.toLowerCase(),
                            count: sectorCounts[s] ?? 0,
                            pct_change: 0,
                            trending: 'stable' as const,
                        }))).map((item) => {
                            const displaySector = item.sector.charAt(0).toUpperCase() + item.sector.slice(1) as Sector;
                            const color = SECTOR_COLORS[displaySector] ?? SECTOR_COLORS['Infrastructure'];
                            const count = sectorInsights
                                ? item.count
                                : sectorCounts[displaySector] ?? 0;
                            const widthPct = maxSectorCount > 0 ? (count / maxSectorCount) * 100 : 0;
                            return (
                                <div key={item.sector}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <svg width="10" height="10" viewBox="0 0 10 10" className="flex-shrink-0">
                                                <circle cx="5" cy="5" r="5" fill={color} />
                                            </svg>
                                            <span className="text-sm font-body">{displaySector}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <TrendBadge trending={item.trending} pct={item.pct_change} />
                                            <span className="text-sm font-mono text-muted-text">{count}</span>
                                        </div>
                                    </div>
                                    <div className="h-3 bg-background rounded-sm overflow-hidden">
                                        <div
                                            className="h-full rounded-sm transition-all"
                                            style={{ width: `${widthPct}%`, backgroundColor: color }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Zone Performance */}
                <div className="card p-5">
                    <h3 className="section-label mb-4">Zone Performance</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        Which zones are being underserved?
                    </p>
                    <div className="space-y-3">
                        {zonePerformance
                            .sort((a, b) => a.rate - b.rate)
                            .map((zone) => (
                                <div key={zone.name}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-body">{zone.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-text font-body">
                                                {zone.resolved}/{zone.total}
                                            </span>
                                            <span className="text-sm font-mono font-medium">{zone.rate}%</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${zone.rate}%`,
                                                backgroundColor: zone.rate < 40
                                                    ? SEVERITY_COLORS['Critical']
                                                    : zone.rate < 60
                                                        ? SEVERITY_COLORS['Medium']
                                                        : SEVERITY_COLORS['Low'],
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Time-to-Resolution Trend — real ML data */}
                <div className="card p-5">
                    <h3 className="section-label mb-4">Time-to-Resolution Trend</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        Is the office getting faster or slower?
                    </p>
                    {!trendChartData ? (
                        <p className="text-xs text-muted-text font-body">
                            No resolution data yet — resolve some issues to see this trend.
                        </p>
                    ) : (
                        <>
                            <div className="flex items-end gap-3 h-36">
                                {trendChartData.map((point, i) => {
                                    const heightPct = (point.avg_days / trendMax) * 100;
                                    const isLatest = i === trendChartData.length - 1;
                                    const label = point.period.slice(5, 10); // MM-DD
                                    return (
                                        <div key={point.period} className="flex-1 flex flex-col items-center gap-1.5">
                                            <span className="text-[10px] font-mono text-muted-text">{point.avg_days}d</span>
                                            <div className="w-full relative" style={{ height: '80px' }}>
                                                <div
                                                    className={`absolute bottom-0 w-full rounded-t transition-all ${isLatest ? 'bg-status-resolved' : 'bg-primary-text'}`}
                                                    style={{ height: `${heightPct * 0.8}%`, opacity: isLatest ? 1 : 0.2 + (i * 0.1) }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono text-muted-text">{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {trendChartData.length >= 2 && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                                    {(() => {
                                        const delta = trendChartData[trendChartData.length - 1].avg_days - trendChartData[0].avg_days;
                                        return (
                                            <>
                                                <span className={`text-xs font-mono ${delta < 0 ? 'text-status-resolved' : 'text-status-critical'}`}>
                                                    {delta < 0 ? '↓' : '↑'} {Math.abs(delta).toFixed(1)} days
                                                </span>
                                                <span className="text-xs text-muted-text font-body">
                                                    {delta < 0 ? 'improvement' : 'increase'} over tracked period
                                                </span>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Recurring Issue Patterns — real ML data */}
                <div className="card p-5">
                    <h3 className="section-label mb-4">Recurring Issue Patterns</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        What keeps coming back and needs a systemic fix?
                    </p>
                    {mlLoading ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-12 bg-background rounded animate-pulse" />
                            ))}
                        </div>
                    ) : recurring.length === 0 ? (
                        <p className="text-xs text-muted-text font-body">
                            No recurring patterns detected yet — patterns emerge as more issues are submitted.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {recurring.slice(0, 5).map((item, i) => {
                                const displaySector = item.sector.charAt(0).toUpperCase() + item.sector.slice(1) as Sector;
                                const sectorColor = SECTOR_COLORS[displaySector] ?? '#666';
                                return (
                                    <div
                                        key={i}
                                        className="p-3 bg-background rounded"
                                        style={{ borderLeft: `3px solid ${sectorColor}` }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: sectorColor }}
                                                />
                                                <span className="text-sm font-body font-medium">{displaySector}</span>
                                                <span className="text-xs text-muted-text font-body">· {item.zone}</span>
                                            </div>
                                            <span className="text-xs font-mono text-muted-text">{item.count} reports</span>
                                        </div>
                                        <span
                                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                            style={{ backgroundColor: severityColor(item.severity) + '20', color: severityColor(item.severity) }}
                                        >
                                            {item.severity}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
