'use client';

import {
    Suspense,
    startTransition,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import IssueDetailDrawer from '@/components/IssueDetailDrawer';
import PlotlyClientChart from '@/components/PlotlyClientChart';
import SectorTag from '@/components/SectorTag';
import SeverityPill from '@/components/SeverityPill';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth } from '@/context/RoleContext';
import { api } from '@/lib/api';
import { matchesConstituencyZone } from '@/lib/geo-scope';
import {
    formatDate,
    Issue,
    Sector,
    SECTOR_COLORS,
    SECTORS,
    Severity,
    SEVERITY_COLORS,
} from '@/lib/mockData';

type InsightFocus =
    | 'sector-rise'
    | 'community-pressure'
    | 'volume-forecast'
    | 'recurring-patterns';

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

interface InsightCardData {
    focus: InsightFocus;
    title: string;
    body: string;
    metric: string;
    color: string;
    sector?: Sector | null;
    zone?: string | null;
}

interface SectorWindowRow {
    sector: Sector;
    currentCount: number;
    priorCount: number;
    pctChange: number;
    trending: 'up' | 'down' | 'stable';
}

interface ZonePressureRow {
    zone: string;
    total: number;
    resolved: number;
    unresolved: number;
    highSeverity: number;
    pressureScore: number;
    residents: number;
}

const WINDOW_DAYS = 14;
const FORECAST_DAYS = 7;

function titleCase(value: string): string {
    return value
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '');
    const full = normalized.length === 3
        ? normalized.split('').map((value) => value + value).join('')
        : normalized;
    const parsed = Number.parseInt(full, 16);
    const red = (parsed >> 16) & 255;
    const green = (parsed >> 8) & 255;
    const blue = parsed & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

function dayKey(date: Date): string {
    return startOfUtcDay(date).toISOString().slice(0, 10);
}

function formatAxisDate(value: string): string {
    return value.slice(5);
}

function isInsightFocus(value: string | null): value is InsightFocus {
    return value === 'sector-rise'
        || value === 'community-pressure'
        || value === 'volume-forecast'
        || value === 'recurring-patterns';
}

function toSector(value: string | null | undefined): Sector {
    if (!value) return 'Other';
    const normalized = value.trim().toLowerCase();
    const match = SECTORS.find((sector) => sector.toLowerCase() === normalized);
    return match ?? 'Other';
}

function isHighSeverity(severity: Severity): boolean {
    return severity === 'High' || severity === 'Critical';
}

function severityRank(severity: Severity | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
        case 'Critical':
        case 'critical':
            return 4;
        case 'High':
        case 'high':
            return 3;
        case 'Medium':
        case 'medium':
            return 2;
        default:
            return 1;
    }
}

function latestAnchor(issues: Issue[]): Date {
    if (issues.length === 0) return startOfUtcDay(new Date());
    return issues.reduce((latest, issue) => {
        const candidate = startOfUtcDay(new Date(issue.submittedAt));
        return candidate > latest ? candidate : latest;
    }, startOfUtcDay(new Date(issues[0].submittedAt)));
}

function getResolutionDays(issue: Issue): number | null {
    const resolved = [...issue.timeline].reverse().find((event) => event.status === 'Verified Resolved')?.date;
    if (!resolved) return null;
    const reported = issue.timeline.find((event) => event.status === 'Reported')?.date ?? issue.submittedAt;
    return Number(((new Date(resolved).getTime() - new Date(reported).getTime()) / 86_400_000).toFixed(1));
}

function buildHistory(issues: Issue[], anchor: Date): { date: string; count: number }[] {
    const counts = new Map<string, number>();
    issues.forEach((issue) => {
        const key = dayKey(new Date(issue.submittedAt));
        counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from({ length: WINDOW_DAYS }, (_, index) => {
        const date = dayKey(addDays(anchor, -(WINDOW_DAYS - index - 1)));
        return { date, count: counts.get(date) ?? 0 };
    });
}

function buildForecast(history: { date: string; count: number }[]): { slope: number; trend: InsightsData['trend']; forecast: ForecastPoint[] } {
    const average = history.length > 0
        ? history.reduce((sum, point) => sum + point.count, 0) / history.length
        : 0;
    const slope = history.length > 1
        ? Number(((history[history.length - 1].count - history[0].count) / (history.length - 1)).toFixed(2))
        : 0;
    const trend: InsightsData['trend'] = slope > 0.15 ? 'increasing' : slope < -0.15 ? 'decreasing' : 'stable';
    const base = history.length > 0 ? startOfUtcDay(new Date(history[history.length - 1].date)) : startOfUtcDay(new Date());

    const forecast = Array.from({ length: FORECAST_DAYS }, (_, index) => {
        const projected = Math.max(0, Math.round(average + (slope * (index + 1))));
        return {
            date: dayKey(addDays(base, index + 1)),
            predicted_count: projected,
            lower: Math.max(0, projected - 1),
            upper: projected + 1,
        };
    });

    return { slope, trend, forecast };
}

function buildSectorWindowRows(issues: Issue[], anchor: Date): SectorWindowRow[] {
    const currentStart = startOfUtcDay(addDays(anchor, -(WINDOW_DAYS - 1)));
    const priorStart = startOfUtcDay(addDays(currentStart, -WINDOW_DAYS));

    return SECTORS.map((sector) => {
        const currentCount = issues.filter((issue) => {
            const submitted = startOfUtcDay(new Date(issue.submittedAt));
            return issue.sector === sector && submitted >= currentStart && submitted <= anchor;
        }).length;
        const priorCount = issues.filter((issue) => {
            const submitted = startOfUtcDay(new Date(issue.submittedAt));
            return issue.sector === sector && submitted >= priorStart && submitted < currentStart;
        }).length;
        const pctChange = priorCount === 0 ? (currentCount > 0 ? 100 : 0) : Math.round(((currentCount - priorCount) / priorCount) * 100);
        const trending: SectorWindowRow['trending'] = currentCount > priorCount
            ? 'up'
            : currentCount < priorCount
                ? 'down'
                : 'stable';
        return { sector, currentCount, priorCount, pctChange, trending };
    })
        .filter((row) => row.currentCount > 0 || row.priorCount > 0)
        .sort((left, right) => (right.currentCount - left.currentCount) || (right.pctChange - left.pctChange));
}

function buildRecurring(issues: Issue[]): RecurringPattern[] {
    const grouped = new Map<string, { zone: string; sector: Sector; count: number; severity: Severity }>();

    issues.forEach((issue) => {
        const key = `${issue.zone}__${issue.sector}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.count += 1;
            if (severityRank(issue.severity) > severityRank(existing.severity)) existing.severity = issue.severity;
            return;
        }
        grouped.set(key, { zone: issue.zone, sector: issue.sector, count: 1, severity: issue.severity });
    });

    return Array.from(grouped.values())
        .filter((entry) => entry.count >= 2)
        .sort((left, right) => (right.count - left.count) || (severityRank(right.severity) - severityRank(left.severity)))
        .map((entry) => ({
            zone: entry.zone,
            sector: entry.sector.toLowerCase(),
            count: entry.count,
            severity: entry.severity === 'Critical' ? 'critical' : entry.severity === 'High' ? 'high' : 'medium',
        }));
}

function buildResponseTrend(issues: Issue[]): TrendPoint[] {
    const grouped = new Map<string, { total: number; count: number }>();

    issues.forEach((issue) => {
        const days = getResolutionDays(issue);
        if (days === null) return;
        const resolvedAt = [...issue.timeline].reverse().find((event) => event.status === 'Verified Resolved')?.date ?? issue.submittedAt;
        const key = resolvedAt.slice(0, 10);
        const current = grouped.get(key) ?? { total: 0, count: 0 };
        current.total += days;
        current.count += 1;
        grouped.set(key, current);
    });

    return Array.from(grouped.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([period, entry]) => ({
            period,
            avg_days: Number((entry.total / entry.count).toFixed(1)),
            count: entry.count,
        }));
}

function SectionCard({
    title,
    caption,
    action,
    children,
}: {
    title: string;
    caption?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="card p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="section-label">{title}</h2>
                    {caption && <p className="mt-1 text-xs text-muted-text font-body">{caption}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function InsightButton({
    card,
    active,
    onClick,
}: {
    card: InsightCardData;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="card p-4 text-left transition-all hover:-translate-y-[1px] hover:shadow-[0_14px_32px_rgba(17,24,39,0.08)]"
            style={{
                borderLeft: `4px solid ${card.color}`,
                background: active ? `linear-gradient(135deg, ${hexToRgba(card.color, 0.08)}, #ffffff 62%)` : 'white',
            }}
        >
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.22em]" style={{ color: card.color }}>
                        AI insight
                    </p>
                    <h3 className="mt-2 text-sm font-semibold text-primary-text">{card.title}</h3>
                </div>
                <span
                    className="rounded-full px-2 py-1 text-[11px] font-mono"
                    style={{ backgroundColor: hexToRgba(card.color, 0.12), color: card.color }}
                >
                    {card.metric}
                </span>
            </div>
            <p className="text-sm leading-6 text-primary-text/85">{card.body}</p>
        </button>
    );
}

function AnalyticsPageContent() {
    const { issues: allIssues, zones: allZones, toggleUpvote, isUpvoted } = useDataStore();
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const insightLabRef = useRef<HTMLElement | null>(null);

    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
    const [drillSector, setDrillSector] = useState<Sector | null>(null);
    const [drillZone, setDrillZone] = useState<string | null>(null);
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [sentiment, setSentiment] = useState<SentimentData | null>(null);
    const [sectorInsights, setSectorInsights] = useState<SectorInsightsData | null>(null);
    const [recurring, setRecurring] = useState<RecurringPattern[]>([]);
    const [responseTrend, setResponseTrend] = useState<TrendPoint[]>([]);
    const [mlLoading, setMlLoading] = useState(true);

    const constituency = user?.constituency ?? 'Ayawaso West Wuogon';

    const issues = useMemo(() => {
        if (!user || user.role !== 'mp' || !user.constituency) return allIssues;
        return allIssues.filter((issue) => matchesConstituencyZone(user.constituency, issue.zone));
    }, [allIssues, user]);

    const zones = useMemo(() => {
        if (!user || user.role !== 'mp' || !user.constituency) return allZones;
        return allZones.filter((zone) => matchesConstituencyZone(user.constituency, zone.name));
    }, [allZones, user]);

    useEffect(() => {
        const zone = user?.constituency ?? '';
        const withQuery = (path: string, params: Record<string, string>) => {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value) query.set(key, value);
            });
            const search = query.toString();
            return search ? `${path}?${search}` : path;
        };

        let cancelled = false;

        async function loadMl() {
            setMlLoading(true);
            const [insightResult, sentimentResult, sectorResult, recurringResult, trendResult] = await Promise.allSettled([
                api.get<InsightsData>(withQuery('/ml/insights', { zone, days: String(WINDOW_DAYS) })),
                api.get<SentimentData>(withQuery('/ml/sentiment', { zone })),
                api.get<SectorInsightsData>(withQuery('/ml/sector-insights', { zone })),
                api.get<{ patterns: RecurringPattern[] }>(withQuery('/ml/recurring', { zone, threshold: '2' })),
                api.get<{ trend: TrendPoint[] }>(withQuery('/ml/response-trend', { zone })),
            ]);

            if (cancelled) return;
            if (insightResult.status === 'fulfilled') setInsights(insightResult.value);
            if (sentimentResult.status === 'fulfilled') setSentiment(sentimentResult.value);
            if (sectorResult.status === 'fulfilled') setSectorInsights(sectorResult.value);
            if (recurringResult.status === 'fulfilled') setRecurring(recurringResult.value.patterns ?? []);
            if (trendResult.status === 'fulfilled') setResponseTrend(trendResult.value.trend ?? []);
            setMlLoading(false);
        }

        void loadMl();

        return () => {
            cancelled = true;
        };
    }, [user?.constituency]);

    const zoneNames = useMemo(() => {
        const live = zones.map((zone) => zone.name);
        return live.length > 0 ? live : Array.from(new Set(issues.map((issue) => issue.zone))).filter(Boolean);
    }, [issues, zones]);

    const anchor = useMemo(() => latestAnchor(issues), [issues]);
    const history = useMemo(() => insights?.historical?.length ? insights.historical : buildHistory(issues, anchor), [anchor, insights?.historical, issues]);
    const derivedForecast = useMemo(() => buildForecast(history), [history]);
    const forecast = useMemo(() => insights?.forecast?.length ? insights.forecast : derivedForecast.forecast, [derivedForecast.forecast, insights?.forecast]);
    const trend = insights?.trend ?? derivedForecast.trend;
    const slope = insights?.slope ?? derivedForecast.slope;
    const response = useMemo(() => responseTrend.length > 0 ? responseTrend : buildResponseTrend(issues), [issues, responseTrend]);
    const sectorRows = useMemo(() => buildSectorWindowRows(issues, anchor), [anchor, issues]);
    const recurringRows = useMemo(() => recurring.length > 0 ? recurring : buildRecurring(issues), [issues, recurring]);

    const zonePressure = useMemo<ZonePressureRow[]>(() => {
        return zoneNames.map((zone) => {
            const zoneIssues = issues.filter((issue) => issue.zone === zone);
            const resolved = zoneIssues.filter((issue) => issue.status === 'Verified Resolved').length;
            const unresolved = zoneIssues.length - resolved;
            const highSeverity = zoneIssues.filter((issue) => isHighSeverity(issue.severity)).length;
            const residents = zoneIssues.reduce((sum, issue) => sum + issue.affectedResidents, 0);
            return {
                zone,
                total: zoneIssues.length,
                resolved,
                unresolved,
                highSeverity,
                pressureScore: Number((unresolved + (highSeverity * 1.6)).toFixed(1)),
                residents,
            };
        })
            .filter((row) => row.total > 0)
            .sort((left, right) => (right.pressureScore - left.pressureScore) || (right.unresolved - left.unresolved));
    }, [issues, zoneNames]);

    const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? null;
    const resolutionRate = issues.length > 0 ? Math.round((issues.filter((issue) => issue.status === 'Verified Resolved').length / issues.length) * 100) : 0;
    const avgResolution = response.length > 0 ? Number((response.reduce((sum, point) => sum + point.avg_days, 0) / response.length).toFixed(1)) : null;
    const highSeverityCount = issues.filter((issue) => isHighSeverity(issue.severity)).length;
    const forecastNextSeven = forecast.reduce((sum, point) => sum + point.predicted_count, 0);
    const topSector = sectorRows.find((row) => row.trending === 'up') ?? sectorRows[0] ?? null;
    const topZone = zonePressure[0] ?? null;
    const topRecurring = recurringRows[0] ?? null;
    const mlAvailable = Boolean(insights || sentiment || sectorInsights || recurring.length > 0 || responseTrend.length > 0);

    const cards = useMemo<InsightCardData[]>(() => {
        const next: InsightCardData[] = [];

        if (topSector) {
            next.push({
                focus: 'sector-rise',
                title: `${topSector.sector} pressure is shifting`,
                body: `${topSector.currentCount} recent ${topSector.sector.toLowerCase()} issues came in during the current ${WINDOW_DAYS}-day window versus ${topSector.priorCount} in the previous one.`,
                metric: `${topSector.pctChange > 0 ? '+' : ''}${topSector.pctChange}%`,
                color: SECTOR_COLORS[topSector.sector],
                sector: topSector.sector,
            });
        }

        if (topZone) {
            next.push({
                focus: 'community-pressure',
                title: `${topZone.zone} is under the most pressure`,
                body: `${topZone.unresolved} unresolved cases and ${topZone.highSeverity} high-severity cases are currently concentrated there.`,
                metric: `${topZone.pressureScore} score`,
                color: sentiment?.overall_severity === 'high' ? SEVERITY_COLORS.Critical : SEVERITY_COLORS.High,
                zone: topZone.zone,
            });
        }

        next.push({
            focus: 'volume-forecast',
            title: trend === 'increasing' ? 'Issue demand is accelerating' : trend === 'decreasing' ? 'Issue demand is easing' : 'Issue demand is steady',
            body: `The current forecast suggests roughly ${Math.round(forecastNextSeven)} reports over the next 7 days with a slope of ${slope > 0 ? '+' : ''}${slope}/day.`,
            metric: `${Math.round(forecastNextSeven)} next 7d`,
            color: trend === 'increasing' ? SEVERITY_COLORS.High : trend === 'decreasing' ? SEVERITY_COLORS.Low : SEVERITY_COLORS.Medium,
        });

        if (topRecurring) {
            const recurringSector = toSector(topRecurring.sector);
            next.push({
                focus: 'recurring-patterns',
                title: `${recurringSector} keeps resurfacing in ${topRecurring.zone}`,
                body: `${topRecurring.count} repeated submissions suggest a systemic issue rather than one-off noise.`,
                metric: `${topRecurring.count} repeats`,
                color: SECTOR_COLORS[recurringSector],
                sector: recurringSector,
                zone: topRecurring.zone,
            });
        }

        return next;
    }, [forecastNextSeven, sentiment?.overall_severity, slope, topRecurring, topSector, topZone, trend]);

    const focus = isInsightFocus(searchParams.get('focus')) ? searchParams.get('focus') : (cards[0]?.focus ?? 'sector-rise');
    const activeSector = drillSector ?? topSector?.sector ?? null;
    const activeZone = drillZone ?? topZone?.zone ?? null;
    const activeRecurring = recurringRows.find((row) => row.zone === (drillZone ?? topRecurring?.zone) && toSector(row.sector) === (drillSector ?? toSector(topRecurring?.sector))) ?? topRecurring ?? null;

    const setFocus = (nextFocus: InsightFocus, options?: { sector?: Sector | null; zone?: string | null; scroll?: boolean }) => {
        if (options?.sector !== undefined) setDrillSector(options.sector);
        if (options?.zone !== undefined) setDrillZone(options.zone);

        const params = new URLSearchParams(searchParams.toString());
        params.set('focus', nextFocus);
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        });

        if (options?.scroll !== false) {
            requestAnimationFrame(() => insightLabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    };

    const clearDrills = () => {
        setDrillSector(null);
        setDrillZone(null);
    };

    const overviewLayout = useMemo(() => ({
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#475569', family: 'system-ui, sans-serif', size: 12 },
        margin: { l: 36, r: 18, t: 18, b: 36 },
    }), []);

    const forecastChartData = useMemo(() => {
        const observedDates = history.map((point) => point.date);
        const forecastDates = forecast.map((point) => point.date);
        const lastObserved = history[history.length - 1];
        const firstForecast = forecast[0];

        return [
            {
                type: 'bar',
                name: 'Observed',
                x: observedDates,
                y: history.map((point) => point.count),
                marker: {
                    color: '#111827',
                    line: { color: '#111827', width: 1 },
                },
                hovertemplate: '<b>%{x|%d %b}</b><br>%{y} observed issues<extra></extra>',
            },
            {
                type: 'bar',
                name: 'Forecast',
                x: forecastDates,
                y: forecast.map((point) => point.predicted_count),
                customdata: forecast.map((point) => [point.lower, point.upper]),
                marker: {
                    color: '#F5A623',
                    line: { color: '#D97706', width: 1 },
                    pattern: {
                        shape: '/',
                        fgcolor: 'rgba(255,255,255,0.55)',
                        size: 7,
                        solidity: 0.3,
                    },
                },
                error_y: {
                    type: 'data',
                    symmetric: false,
                    array: forecast.map((point) => point.upper - point.predicted_count),
                    arrayminus: forecast.map((point) => point.predicted_count - point.lower),
                    color: 'rgba(217,119,6,0.7)',
                    thickness: 1.1,
                    width: 0,
                    visible: true,
                },
                hovertemplate: '<b>%{x|%d %b}</b><br>%{y} forecast issues<br>Range %{customdata[0]}-%{customdata[1]}<extra></extra>',
            },
            {
                type: 'scatter',
                mode: 'lines',
                x: lastObserved && firstForecast ? [lastObserved.date, firstForecast.date] : [],
                y: lastObserved && firstForecast ? [lastObserved.count, firstForecast.predicted_count] : [],
                line: { color: 'rgba(245,166,35,0.45)', width: 1.5, dash: 'dot' },
                hoverinfo: 'skip',
                showlegend: false,
            },
        ];
    }, [forecast, history]);

    const forecastLayout = useMemo(() => ({
        ...overviewLayout,
        height: 300,
        hovermode: 'x unified',
        legend: { orientation: 'h', x: 0, y: 1.15, font: { size: 11, color: '#475569' } },
        xaxis: {
            type: 'date',
            tickformat: '%d %b',
            tickfont: { size: 11, color: '#64748B' },
            showgrid: false,
            automargin: true,
            ticklabelmode: 'period',
        },
        yaxis: {
            rangemode: 'tozero',
            gridcolor: 'rgba(148,163,184,0.18)',
            dtick: 1,
            tickfont: { size: 11, color: '#64748B' },
            title: {
                text: 'Issues / day',
                font: { size: 11, color: '#64748B' },
                standoff: 10,
            },
        },
        barmode: 'overlay',
        bargap: 0.35,
        shapes: forecast.length > 0 ? [
            {
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0: forecast[0].date,
                x1: addDays(new Date(forecast[forecast.length - 1].date), 1).toISOString(),
                y0: 0,
                y1: 1,
                fillcolor: 'rgba(245,166,35,0.05)',
                line: { width: 0 },
                layer: 'below',
            },
        ] : [],
        annotations: forecast.length > 0 ? [
            {
                x: forecast[0].date,
                y: 1.08,
                xref: 'x',
                yref: 'paper',
                text: 'Forecast window',
                showarrow: false,
                xanchor: 'left',
                font: { size: 11, color: '#D97706' },
            },
        ] : [],
    }), [forecast, history, overviewLayout]);

    const zoneBalanceRows = useMemo(() => zonePressure.map((row) => ({
        zone: row.zone,
        resolved: row.resolved,
        unresolved: row.unresolved,
    })), [zonePressure]);

    const zoneBalanceData = useMemo(() => ([
        {
            type: 'bar',
            name: 'Resolved',
            x: zoneBalanceRows.map((row) => row.zone),
            y: zoneBalanceRows.map((row) => row.resolved),
            marker: { color: '#2E7D32' },
        },
        {
            type: 'bar',
            name: 'Unresolved',
            x: zoneBalanceRows.map((row) => row.zone),
            y: zoneBalanceRows.map((row) => row.unresolved),
            marker: { color: '#C62828' },
        },
    ]), [zoneBalanceRows]);

    const zoneBalanceLayout = useMemo(() => ({
        ...overviewLayout,
        height: 300,
        barmode: 'stack',
        legend: { orientation: 'h', x: 0, y: 1.15, font: { size: 11, color: '#475569' } },
        yaxis: { rangemode: 'tozero', gridcolor: 'rgba(148,163,184,0.18)', dtick: 1 },
    }), [overviewLayout]);

    const activeFilterChips = [
        activeSector ? { label: `Sector: ${activeSector}`, color: SECTOR_COLORS[activeSector] } : null,
        activeZone ? { label: `Zone: ${activeZone}`, color: '#1E3A8A' } : null,
    ].filter(Boolean) as { label: string; color: string }[];

    const evidenceIssues = useMemo(() => {
        if (focus === 'sector-rise') {
            return issues.filter((issue) => (!activeSector || issue.sector === activeSector) && (!activeZone || issue.zone === activeZone));
        }
        if (focus === 'community-pressure') {
            return issues.filter((issue) => (!activeZone || issue.zone === activeZone) && (issue.status !== 'Verified Resolved' || isHighSeverity(issue.severity)));
        }
        if (focus === 'volume-forecast') {
            const start = startOfUtcDay(addDays(anchor, -(WINDOW_DAYS - 1)));
            return issues.filter((issue) => {
                const submitted = startOfUtcDay(new Date(issue.submittedAt));
                return submitted >= start && submitted <= anchor && (!activeZone || issue.zone === activeZone);
            });
        }
        return issues.filter((issue) => (!activeRecurring || (issue.zone === activeRecurring.zone && issue.sector === toSector(activeRecurring.sector))));
    }, [activeRecurring, activeSector, activeZone, anchor, focus, issues]);

    const deferredEvidenceIssues = useDeferredValue(
        evidenceIssues.slice().sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()),
    );

    const detailSummary = focus === 'sector-rise'
        ? `${activeSector ?? 'Selected sector'} is broken down below so the MP can see whether the rise is real and where it is clustering.`
        : focus === 'community-pressure'
            ? `${activeZone ?? 'The leading zone'} is shown against the wider constituency to explain why community pressure is building there.`
            : focus === 'volume-forecast'
                ? 'This view links the forecast to the recent incoming issue pattern so the MP can see the trend, not just the prediction.'
                : 'This view isolates repeated zone-and-sector combinations so recurring problems can be escalated as structural fixes.';

    return (
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-muted-text">Analytics &amp; Intelligence</p>
                    <h1 className="mt-2 font-display text-3xl font-semibold text-primary-text">Constituency intelligence desk</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-text">
                        Decision support for {constituency}. Click insights and charts to trace every headline back to the underlying issue records.
                    </p>
                </div>
                <div
                    className="rounded-full border px-3 py-2 text-xs font-mono"
                    style={{
                        borderColor: mlAvailable ? 'rgba(46,125,50,0.18)' : 'rgba(148,163,184,0.24)',
                        backgroundColor: mlAvailable ? 'rgba(46,125,50,0.08)' : 'rgba(148,163,184,0.08)',
                        color: mlAvailable ? '#2E7D32' : '#475569',
                    }}
                >
                    {mlLoading ? 'Refreshing ML signals...' : mlAvailable ? 'ML live + case-backed' : 'Derived from live case data'}
                </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Total Issues" value={issues.length} color="#111111" subtitle="Current constituency scope" />
                <StatCard label="Resolution Rate" value={`${resolutionRate}%`} color="#2E7D32" subtitle="Verified resolved / total" />
                <StatCard label="Avg Resolution" value={avgResolution ? `${avgResolution}d` : '—'} color="#F5A623" subtitle="Across resolved cases" />
                <StatCard label="High Severity" value={highSeverityCount} color="#C62828" subtitle="High + critical cases" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard title="Demand Pulse" caption="Observed issue volume plus the near-term forecast. Click to open the forecast lab.">
                    <PlotlyClientChart
                        className="h-[300px]"
                        config={{ displayModeBar: false }}
                        data={forecastChartData}
                        layout={forecastLayout}
                        onPointClick={() => setFocus('volume-forecast')}
                    />
                </SectionCard>

                <SectionCard title="Zone Delivery Balance" caption="Resolved versus unresolved cases by zone. Click a zone to inspect pressure.">
                    <PlotlyClientChart
                        className="h-[300px]"
                        config={{ displayModeBar: false }}
                        data={zoneBalanceData}
                        layout={zoneBalanceLayout}
                        onPointClick={(point) => {
                            const zone = typeof point.x === 'string' ? point.x : null;
                            if (!zone) return;
                            setFocus('community-pressure', { zone });
                        }}
                    />
                </SectionCard>
            </div>

            <div className="mb-6">
                <div className="mb-3">
                    <h2 className="section-label">AI insights</h2>
                    <p className="mt-1 text-xs text-muted-text font-body">Each insight is clickable and leads into an evidence-backed drill-down below.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {cards.map((card) => (
                        <InsightButton
                            key={`${card.focus}-${card.title}`}
                            card={card}
                            active={focus === card.focus}
                            onClick={() => setFocus(card.focus, { sector: card.sector, zone: card.zone })}
                        />
                    ))}
                </div>
            </div>

            <section
                ref={insightLabRef}
                className="mb-6 rounded-[28px] border border-border bg-[linear-gradient(180deg,#fffefc_0%,#ffffff_18%,#fffaf4_100%)] p-5 shadow-[0_18px_50px_rgba(17,24,39,0.05)]"
            >
                <div className="mb-5 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-muted-text">Insight Lab</p>
                        <h2 className="mt-2 font-display text-2xl font-semibold text-primary-text">
                            {focus === 'sector-rise' ? 'Sector Rise Breakdown' : focus === 'community-pressure' ? 'Community Pressure Lab' : focus === 'volume-forecast' ? 'Demand Forecast Lab' : 'Recurring Pattern Lab'}
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-text">{detailSummary}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {activeFilterChips.map((chip) => (
                            <span
                                key={chip.label}
                                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-body"
                                style={{ borderColor: hexToRgba(chip.color, 0.2), backgroundColor: hexToRgba(chip.color, 0.08), color: chip.color }}
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />
                                {chip.label}
                            </span>
                        ))}
                        {activeFilterChips.length > 0 && (
                            <button type="button" onClick={clearDrills} className="rounded-full border border-border px-3 py-1 text-xs text-muted-text font-body hover:text-primary-text">
                                Clear drill filters
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {focus === 'sector-rise' && (
                        <>
                            <SectionCard title="Current vs prior sector volume" caption={`Compare the last ${WINDOW_DAYS} days against the previous ${WINDOW_DAYS}-day window.`}>
                                <PlotlyClientChart
                                    className="h-[320px]"
                                    config={{ displayModeBar: false }}
                                    data={[
                                        {
                                            type: 'bar',
                                            name: `Current ${WINDOW_DAYS}d`,
                                            x: sectorRows.map((row) => row.sector),
                                            y: sectorRows.map((row) => row.currentCount),
                                            marker: { color: sectorRows.map((row) => hexToRgba(SECTOR_COLORS[row.sector], activeSector === row.sector ? 0.95 : 0.55)) },
                                        },
                                        {
                                            type: 'bar',
                                            name: `Prior ${WINDOW_DAYS}d`,
                                            x: sectorRows.map((row) => row.sector),
                                            y: sectorRows.map((row) => row.priorCount),
                                            marker: { color: sectorRows.map((row) => hexToRgba(SECTOR_COLORS[row.sector], 0.18)) },
                                        },
                                    ]}
                                    layout={{ ...overviewLayout, height: 320, barmode: 'group', legend: { orientation: 'h', x: 0, y: 1.14 } }}
                                    onPointClick={(point) => {
                                        const sector = toSector(typeof point.x === 'string' ? point.x : null);
                                        setFocus('sector-rise', { sector, scroll: false });
                                    }}
                                />
                            </SectionCard>
                            <SectionCard title={activeSector ? `${activeSector} by zone` : 'Zone clustering'} caption="Click a zone bar to narrow the evidence list.">
                                <PlotlyClientChart
                                    className="h-[320px]"
                                    config={{ displayModeBar: false }}
                                    data={[
                                        {
                                            type: 'bar',
                                            orientation: 'h',
                                            y: zoneNames,
                                            x: zoneNames.map((zone) => issues.filter((issue) => issue.zone === zone && (!activeSector || issue.sector === activeSector)).length),
                                            marker: { color: activeSector ? hexToRgba(SECTOR_COLORS[activeSector], 0.9) : '#F5A623' },
                                        },
                                    ]}
                                    layout={{ ...overviewLayout, height: 320, margin: { l: 120, r: 18, t: 18, b: 28 }, xaxis: { rangemode: 'tozero', dtick: 1, gridcolor: 'rgba(148,163,184,0.18)' } }}
                                    onPointClick={(point) => {
                                        const zone = typeof point.y === 'string' ? point.y : null;
                                        if (!zone) return;
                                        setFocus('sector-rise', { sector: activeSector, zone, scroll: false });
                                    }}
                                />
                            </SectionCard>
                        </>
                    )}

                    {focus === 'community-pressure' && (
                        <>
                            <SectionCard title={activeZone ? `${activeZone} severity mix` : 'Severity mix'} caption="This shows whether the pressure is routine or high-stakes.">
                                <PlotlyClientChart
                                    className="h-[320px]"
                                    config={{ displayModeBar: false }}
                                    data={[
                                        {
                                            type: 'pie',
                                            labels: ['Low', 'Medium', 'High/Critical'],
                                            values: [
                                                issues.filter((issue) => (!activeZone || issue.zone === activeZone) && issue.severity === 'Low').length,
                                                issues.filter((issue) => (!activeZone || issue.zone === activeZone) && issue.severity === 'Medium').length,
                                                issues.filter((issue) => (!activeZone || issue.zone === activeZone) && isHighSeverity(issue.severity)).length,
                                            ],
                                            hole: 0.64,
                                            marker: { colors: ['#2E7D32', '#F5A623', '#C62828'] },
                                            textinfo: 'label+percent',
                                            sort: false,
                                        },
                                    ]}
                                    layout={{ ...overviewLayout, height: 320, margin: { l: 10, r: 10, t: 10, b: 10 }, showlegend: false }}
                                />
                            </SectionCard>
                            <SectionCard title="Zone pressure ranking" caption="Pressure weights unresolved and high-severity cases above routine volume.">
                                <PlotlyClientChart
                                    className="h-[320px]"
                                    config={{ displayModeBar: false }}
                                    data={[
                                        {
                                            type: 'bar',
                                            orientation: 'h',
                                            y: zonePressure.map((row) => row.zone),
                                            x: zonePressure.map((row) => row.pressureScore),
                                            marker: { color: zonePressure.map((row) => activeZone === row.zone ? '#C62828' : '#F5A623') },
                                        },
                                    ]}
                                    layout={{ ...overviewLayout, height: 320, margin: { l: 120, r: 18, t: 18, b: 28 }, xaxis: { rangemode: 'tozero', gridcolor: 'rgba(148,163,184,0.18)' } }}
                                    onPointClick={(point) => {
                                        const zone = typeof point.y === 'string' ? point.y : null;
                                        if (!zone) return;
                                        setFocus('community-pressure', { zone, scroll: false });
                                    }}
                                />
                            </SectionCard>
                        </>
                    )}

                    {focus === 'volume-forecast' && (
                        <>
                            <SectionCard title="Demand pulse and forecast" caption="Observed volume and the forward forecast band.">
                                <PlotlyClientChart className="h-[320px]" config={{ displayModeBar: false }} data={forecastChartData} layout={{ ...forecastLayout, height: 320 }} />
                            </SectionCard>
                            <SectionCard title="Recent demand by zone" caption={`Recent means the current rolling ${WINDOW_DAYS}-day window.`}>
                                <PlotlyClientChart
                                    className="h-[320px]"
                                    config={{ displayModeBar: false }}
                                    data={[
                                        {
                                            type: 'bar',
                                            x: zoneNames,
                                            y: zoneNames.map((zone) => issues.filter((issue) => issue.zone === zone && startOfUtcDay(new Date(issue.submittedAt)) >= startOfUtcDay(addDays(anchor, -(WINDOW_DAYS - 1)))).length),
                                            marker: { color: zoneNames.map((zone) => activeZone === zone ? '#111827' : '#94A3B8') },
                                        },
                                    ]}
                                    layout={{ ...overviewLayout, height: 320, yaxis: { rangemode: 'tozero', dtick: 1, gridcolor: 'rgba(148,163,184,0.18)' } }}
                                    onPointClick={(point) => {
                                        const zone = typeof point.x === 'string' ? point.x : null;
                                        if (!zone) return;
                                        setFocus('volume-forecast', { zone, scroll: false });
                                    }}
                                />
                            </SectionCard>
                        </>
                    )}

                    {focus === 'recurring-patterns' && (
                        <>
                            <SectionCard title="Recurring heatmap" caption="Darker cells mean a zone-and-sector combination appears repeatedly.">
                                <PlotlyClientChart
                                    className="h-[320px]"
                                    config={{ displayModeBar: false }}
                                    data={[
                                        {
                                            type: 'heatmap',
                                            x: SECTORS,
                                            y: zoneNames,
                                            z: zoneNames.map((zone) => SECTORS.map((sector) => issues.filter((issue) => issue.zone === zone && issue.sector === sector).length)),
                                            colorscale: [[0, '#FFF7ED'], [0.5, '#FDBA74'], [1, '#C2410C']],
                                        },
                                    ]}
                                    layout={{ ...overviewLayout, height: 320, margin: { l: 120, r: 18, t: 18, b: 54 } }}
                                    onPointClick={(point) => {
                                        const zone = typeof point.y === 'string' ? point.y : null;
                                        const sector = toSector(typeof point.x === 'string' ? point.x : null);
                                        if (!zone) return;
                                        setFocus('recurring-patterns', { zone, sector, scroll: false });
                                    }}
                                />
                            </SectionCard>
                            <SectionCard title="Ranked repeated clusters" caption="Click a recurring cluster to isolate its evidence.">
                                <PlotlyClientChart
                                    className="h-[320px]"
                                    config={{ displayModeBar: false }}
                                    data={[
                                        {
                                            type: 'bar',
                                            orientation: 'h',
                                            y: recurringRows.map((row) => `${titleCase(row.sector)} · ${row.zone}`),
                                            x: recurringRows.map((row) => row.count),
                                            customdata: recurringRows.map((row) => ({ sector: toSector(row.sector), zone: row.zone })),
                                            marker: { color: recurringRows.map((row) => hexToRgba(SECTOR_COLORS[toSector(row.sector)], activeRecurring && row.zone === activeRecurring.zone && row.sector === activeRecurring.sector ? 0.95 : 0.45)) },
                                        },
                                    ]}
                                    layout={{ ...overviewLayout, height: 320, margin: { l: 180, r: 18, t: 18, b: 28 }, xaxis: { rangemode: 'tozero', dtick: 1, gridcolor: 'rgba(148,163,184,0.18)' } }}
                                    onPointClick={(point) => {
                                        const payload = point.customdata as { sector?: Sector; zone?: string } | undefined;
                                        if (!payload?.zone || !payload.sector) return;
                                        setFocus('recurring-patterns', { zone: payload.zone, sector: payload.sector, scroll: false });
                                    }}
                                />
                            </SectionCard>
                        </>
                    )}
                </div>
            </section>

            <SectionCard title="Evidence Trail" caption="These are the real issue records supporting the selected insight." action={<span className="text-xs font-mono text-muted-text">{deferredEvidenceIssues.length} records</span>}>
                {deferredEvidenceIssues.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-text font-body">
                        No issues match the current drill filters.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {deferredEvidenceIssues.map((issue) => (
                            <button
                                key={issue.id}
                                type="button"
                                onClick={() => setSelectedIssueId(issue.id)}
                                className="w-full rounded-2xl border border-border bg-white p-4 text-left transition-all hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(17,24,39,0.06)]"
                            >
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] font-mono text-muted-text">{issue.id}</span>
                                            <StatusPill status={issue.status} />
                                            <SeverityPill severity={issue.severity} />
                                            <SectorTag sector={issue.sector} />
                                        </div>
                                        <h3 className="mt-3 text-base font-semibold text-primary-text">{issue.title}</h3>
                                        <p className="mt-2 text-sm leading-6 text-muted-text">{issue.description}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 xl:min-w-[360px] xl:grid-cols-4">
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-text">Zone</p>
                                            <p className="mt-1 text-sm text-primary-text font-body">{issue.zone}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-text">Residents</p>
                                            <p className="mt-1 text-sm text-primary-text font-body">{issue.affectedResidents.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-text">Support</p>
                                            <p className="mt-1 text-sm text-primary-text font-body">{issue.upvotes}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-text">Submitted</p>
                                            <p className="mt-1 text-sm text-primary-text font-body">{formatDate(issue.submittedAt)}</p>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </SectionCard>

            <IssueDetailDrawer
                issue={selectedIssue}
                onClose={() => setSelectedIssueId(null)}
                isUpvoted={selectedIssue ? isUpvoted(selectedIssue.id) : false}
                onUpvote={selectedIssue ? () => { void toggleUpvote(selectedIssue.id); } : undefined}
            />
        </div>
    );
}

export default function AnalyticsPage() {
    return (
        <Suspense fallback={<div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6" />}>
            <AnalyticsPageContent />
        </Suspense>
    );
}
