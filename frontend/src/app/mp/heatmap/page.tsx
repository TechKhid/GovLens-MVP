'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import EmptyState from '@/components/EmptyState';
import IssueDetailDrawer from '@/components/IssueDetailDrawer';
import PlotlyClientChart from '@/components/PlotlyClientChart';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import SectorTag from '@/components/SectorTag';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth } from '@/context/RoleContext';
import { matchesConstituencyZone } from '@/lib/geo-scope';
import { type Issue, SECTOR_COLORS, STATUSES, type ZoneData } from '@/lib/mockData';

const IssueHeatmapMap = dynamic(() => import('@/components/IssueHeatmapMap'), {
    ssr: false,
    loading: () => (
        <div className="flex w-full items-center justify-center rounded-lg bg-background" style={{ height: '500px' }}>
            <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary-text border-t-transparent" />
                <span className="text-sm font-body text-muted-text">Loading constituency map...</span>
            </div>
        </div>
    ),
});

function hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '');
    const fullHex = normalized.length === 3
        ? normalized.split('').map((value) => value + value).join('')
        : normalized;

    const parsed = Number.parseInt(fullHex, 16);
    const red = (parsed >> 16) & 255;
    const green = (parsed >> 8) & 255;
    const blue = parsed & 255;

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function severityScore(issue: Issue): number {
    switch (issue.severity) {
        case 'Critical':
            return 4;
        case 'High':
            return 3;
        case 'Medium':
            return 2;
        case 'Low':
        default:
            return 1;
    }
}

function zonePressure(zone: ZoneData, issues: Issue[]): number {
    const zoneIssues = issues.filter((issue) => issue.zone === zone.name);
    const unresolved = zone.issueCount - zone.resolvedCount;
    const severityLoad = zoneIssues.reduce((sum, issue) => sum + severityScore(issue), 0);
    return unresolved * 2 + severityLoad;
}

function buildWeeklyTrend(issues: Issue[]) {
    const byWeek = new Map<string, number>();

    issues.forEach((issue) => {
        const createdAt = new Date(issue.submittedAt);
        if (Number.isNaN(createdAt.getTime())) return;

        const weekStart = new Date(createdAt);
        const day = weekStart.getUTCDay();
        const diff = day === 0 ? -6 : 1 - day;
        weekStart.setUTCDate(weekStart.getUTCDate() + diff);
        weekStart.setUTCHours(0, 0, 0, 0);

        const key = weekStart.toISOString().slice(0, 10);
        byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
    });

    return Array.from(byWeek.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-8)
        .map(([date, count]) => ({
            count,
            date,
            label: new Date(date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
            }),
        }));
}

export default function MPHeatmapPage() {
    const { issues, zones, toggleUpvote, isUpvoted } = useDataStore();
    const { user } = useAuth();
    const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

    const constituency = user?.constituency ?? '';

    const scopedIssues = useMemo(() => {
        if (!constituency) return [];
        return issues.filter((issue) => matchesConstituencyZone(constituency, issue.zone));
    }, [constituency, issues]);

    const scopedZones = useMemo(() => {
        if (!constituency) return [];
        return zones.filter((zone) => matchesConstituencyZone(constituency, zone.name));
    }, [constituency, zones]);

    useEffect(() => {
        if (selectedZone && !scopedZones.some((zone) => zone.id === selectedZone.id)) {
            setSelectedZone(null);
        }
    }, [scopedZones, selectedZone]);

    useEffect(() => {
        if (selectedIssueId && !scopedIssues.some((issue) => issue.id === selectedIssueId)) {
            setSelectedIssueId(null);
        }
    }, [scopedIssues, selectedIssueId]);

    const selectedIssue = scopedIssues.find((issue) => issue.id === selectedIssueId) ?? null;

    const openIssues = useMemo(
        () => scopedIssues.filter((issue) => issue.status !== 'Verified Resolved'),
        [scopedIssues],
    );

    const highPriorityOpenIssues = useMemo(
        () => openIssues.filter((issue) => issue.severity === 'High' || issue.severity === 'Critical'),
        [openIssues],
    );

    const hottestZone = useMemo(() => {
        if (scopedZones.length === 0) return null;

        return [...scopedZones].sort((left, right) => zonePressure(right, scopedIssues) - zonePressure(left, scopedIssues))[0] ?? null;
    }, [scopedIssues, scopedZones]);

    const activeZone = selectedZone ?? hottestZone;

    const activeZoneIssues = useMemo(() => {
        if (!activeZone) return [];

        return scopedIssues
            .filter((issue) => issue.zone === activeZone.name)
            .sort((left, right) => {
                const severityDelta = severityScore(right) - severityScore(left);
                if (severityDelta !== 0) return severityDelta;
                return right.upvotes - left.upvotes;
            });
    }, [activeZone, scopedIssues]);

    const resolutionRate = scopedIssues.length === 0
        ? 0
        : Math.round((scopedIssues.filter((issue) => issue.status === 'Verified Resolved').length / scopedIssues.length) * 100);

    const statusMix = useMemo(() => {
        return STATUSES.map((status) => ({
            count: scopedIssues.filter((issue) => issue.status === status).length,
            status,
        })).filter((point) => point.count > 0);
    }, [scopedIssues]);

    const sectorPressure = useMemo(() => {
        const grouped = new Map<string, { count: number; pressure: number }>();

        scopedIssues.forEach((issue) => {
            const current = grouped.get(issue.sector) ?? { count: 0, pressure: 0 };
            current.count += 1;
            current.pressure += severityScore(issue) + (issue.status === 'Verified Resolved' ? 0 : 2);
            grouped.set(issue.sector, current);
        });

        return Array.from(grouped.entries())
            .map(([sector, data]) => ({
                color: SECTOR_COLORS[sector as keyof typeof SECTOR_COLORS] ?? '#6B6B6B',
                count: data.count,
                pressure: data.pressure,
                sector,
            }))
            .sort((left, right) => right.pressure - left.pressure);
    }, [scopedIssues]);

    const recentTrend = useMemo(() => buildWeeklyTrend(scopedIssues), [scopedIssues]);

    const sharedLayout = useMemo(() => ({
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#4B5563', family: 'system-ui, sans-serif', size: 12 },
    }), []);

    const statusMixData = useMemo(() => ([
        {
            type: 'pie',
            labels: statusMix.map((point) => point.status),
            values: statusMix.map((point) => point.count),
            hole: 0.58,
            marker: {
                colors: statusMix.map((point) => hexToRgba('#1E3A8A', point.status === 'Verified Resolved' ? 0.4 : 0.88)),
                line: { color: '#FFFFFF', width: 2 },
            },
            textinfo: 'label+percent',
            hovertemplate: '<b>%{label}</b><br>%{value} issues<extra></extra>',
        },
    ]), [statusMix]);

    const sectorPressureData = useMemo(() => ([
        {
            type: 'bar',
            orientation: 'h',
            y: sectorPressure.map((point) => point.sector),
            x: sectorPressure.map((point) => point.pressure),
            text: sectorPressure.map((point) => `${point.count}`),
            textposition: 'outside',
            cliponaxis: false,
            marker: {
                color: sectorPressure.map((point) => hexToRgba(point.color, 0.86)),
                line: {
                    color: sectorPressure.map((point) => point.color),
                    width: 1.5,
                },
            },
            hovertemplate: '<b>%{y}</b><br>Pressure %{x}<br>%{text} issues<extra></extra>',
        },
    ]), [sectorPressure]);

    const recentTrendData = useMemo(() => ([
        {
            type: 'scatter',
            mode: 'lines+markers',
            x: recentTrend.map((point) => point.label),
            y: recentTrend.map((point) => point.count),
            line: { color: '#1E3A8A', width: 3, shape: 'spline' },
            marker: { color: '#C62828', size: 9 },
            fill: 'tozeroy',
            fillcolor: 'rgba(30, 58, 138, 0.08)',
            hovertemplate: '<b>%{x}</b><br>%{y} issues logged<extra></extra>',
        },
    ]), [recentTrend]);

    const activeZoneOpenIssues = activeZone
        ? activeZoneIssues.filter((issue) => issue.status !== 'Verified Resolved').length
        : 0;
    const activeZoneCriticalLoad = activeZoneIssues.filter((issue) => issue.severity === 'High' || issue.severity === 'Critical').length;
    const activeZoneResolutionRate = activeZone && activeZone.issueCount > 0
        ? Math.round((activeZone.resolvedCount / activeZone.issueCount) * 100)
        : 0;

    return (
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
            <div className="mb-6">
                <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-muted-text">MP command view</p>
                <h1 className="mt-2 font-display text-3xl font-semibold text-primary-text">Constituency heatmap</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-text font-body">
                    A map-first pressure view for {constituency || 'your constituency'} with live hotspots,
                    open-case density, and quick issue drill-in for constituency teams.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    color="#1E3A8A"
                    label="Open issues"
                    subtitle="Excludes verified resolved cases"
                    value={openIssues.length}
                />
                <StatCard
                    color="#C62828"
                    label="High-priority issues"
                    subtitle="High + critical severity still open"
                    value={highPriorityOpenIssues.length}
                />
                <StatCard
                    color="#2E7D32"
                    label="Resolution rate"
                    subtitle="Verified resolved across constituency scope"
                    value={`${resolutionRate}%`}
                />
                <StatCard
                    color="#F57C00"
                    label="Hottest zone"
                    subtitle={hottestZone ? `${hottestZone.issueCount} total issues` : 'No hotspots yet'}
                    value={hottestZone?.name ?? 'N/A'}
                />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="card p-4">
                    <IssueHeatmapMap
                        constituency={constituency}
                        issues={scopedIssues}
                        onIssueSelect={setSelectedIssueId}
                        onZoneSelect={setSelectedZone}
                        selectedZone={selectedZone}
                        zones={scopedZones}
                    />
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-text font-body">
                        <span className="font-medium text-primary-text">Map cues</span>
                        <span>Adaptive base = local daylight mode</span>
                        <span>Heat overlay = issue density</span>
                        <span>Zone fields = pressure bloom</span>
                        <span>Zone cores = total zone reports</span>
                        <span>Contour bands = escalation rings</span>
                        <span>Issue pins appear when a hotspot is selected</span>
                    </div>
                </div>

                <aside className="card p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                        <div>
                            <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Hotspot panel</p>
                            <h2 className="mt-1 font-display text-xl font-semibold text-primary-text">
                                {activeZone?.name ?? 'No hotspot selected'}
                            </h2>
                        </div>
                        {selectedZone ? (
                            <button
                                className="text-xs font-body text-muted-text transition-colors hover:text-primary-text"
                                onClick={() => setSelectedZone(null)}
                                type="button"
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>

                    {!activeZone ? (
                        <div className="py-8">
                            <EmptyState message="No constituency issues are available for hotspot analysis yet." />
                        </div>
                    ) : (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-2xl border border-border bg-background px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Open</p>
                                    <p className="mt-1 font-mono text-xl font-semibold text-primary-text">{activeZoneOpenIssues}</p>
                                </div>
                                <div className="rounded-2xl border border-border bg-background px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Hot</p>
                                    <p className="mt-1 font-mono text-xl font-semibold text-status-critical">{activeZoneCriticalLoad}</p>
                                </div>
                                <div className="rounded-2xl border border-border bg-background px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Resolved</p>
                                    <p className="mt-1 font-mono text-xl font-semibold text-status-resolved">{activeZoneResolutionRate}%</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border bg-white">
                                <div className="border-b border-border px-4 py-3">
                                    <h3 className="text-sm font-body font-medium text-primary-text">Priority issues in this zone</h3>
                                </div>
                                {activeZoneIssues.length === 0 ? (
                                    <div className="px-4 py-6">
                                        <EmptyState message="No logged issues for this zone yet." />
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {activeZoneIssues.slice(0, 6).map((issue) => (
                                            <button
                                                className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-background"
                                                key={issue.id}
                                                onClick={() => setSelectedIssueId(issue.id)}
                                                type="button"
                                            >
                                                <p className="line-clamp-1 text-sm font-body font-medium text-primary-text">{issue.title}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <SectorTag sector={issue.sector} />
                                                    <StatusPill status={issue.status} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedZone ? null : scopedZones.length > 0 ? (
                                <div className="rounded-2xl border border-border bg-white">
                                    <div className="border-b border-border px-4 py-3">
                                        <h3 className="text-sm font-body font-medium text-primary-text">Other hotspot zones</h3>
                                    </div>
                                    <div className="divide-y divide-border">
                                        {scopedZones
                                            .filter((zone) => zone.id !== activeZone.id)
                                            .sort((left, right) => zonePressure(right, scopedIssues) - zonePressure(left, scopedIssues))
                                            .slice(0, 4)
                                            .map((zone) => (
                                                <button
                                                    className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-background"
                                                    key={zone.id}
                                                    onClick={() => setSelectedZone(zone)}
                                                    type="button"
                                                >
                                                    <div>
                                                        <p className="text-sm font-body font-medium text-primary-text">{zone.name}</p>
                                                        <p className="text-xs text-muted-text font-body">{zone.issueCount - zone.resolvedCount} open issues</p>
                                                    </div>
                                                    <span className="font-mono text-xs text-muted-text">{zonePressure(zone, scopedIssues)}</span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                </aside>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <section className="card p-4">
                    <div className="mb-4">
                        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Analytics</p>
                        <h3 className="mt-1 font-display text-xl font-semibold text-primary-text">Status mix</h3>
                    </div>
                    {statusMix.length === 0 ? (
                        <EmptyState message="No constituency issues are available for status analysis yet." />
                    ) : (
                        <PlotlyClientChart
                            data={statusMixData}
                            layout={{
                                ...sharedLayout,
                                height: 270,
                                margin: { b: 10, l: 10, r: 10, t: 10 },
                                showlegend: false,
                            }}
                        />
                    )}
                </section>

                <section className="card p-4">
                    <div className="mb-4">
                        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Analytics</p>
                        <h3 className="mt-1 font-display text-xl font-semibold text-primary-text">Sector pressure</h3>
                    </div>
                    {sectorPressure.length === 0 ? (
                        <EmptyState message="No sector pressure signal is available yet." />
                    ) : (
                        <PlotlyClientChart
                            data={sectorPressureData}
                            layout={{
                                ...sharedLayout,
                                height: 270,
                                margin: { b: 24, l: 110, r: 24, t: 10 },
                                showlegend: false,
                                xaxis: {
                                    dtick: 1,
                                    gridcolor: 'rgba(17, 24, 39, 0.08)',
                                    rangemode: 'tozero',
                                    tickfont: { color: '#6B7280', size: 11 },
                                    zeroline: false,
                                },
                                yaxis: {
                                    automargin: true,
                                    tickfont: { color: '#4B5563', size: 11 },
                                },
                            }}
                        />
                    )}
                </section>

                <section className="card p-4">
                    <div className="mb-4">
                        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Analytics</p>
                        <h3 className="mt-1 font-display text-xl font-semibold text-primary-text">Recent issue trend</h3>
                    </div>
                    {recentTrend.length === 0 ? (
                        <EmptyState message="No recent issue trend is available yet." />
                    ) : (
                        <PlotlyClientChart
                            data={recentTrendData}
                            layout={{
                                ...sharedLayout,
                                height: 270,
                                margin: { b: 28, l: 28, r: 18, t: 10 },
                                showlegend: false,
                                xaxis: {
                                    tickfont: { color: '#6B7280', size: 11 },
                                },
                                yaxis: {
                                    dtick: 1,
                                    gridcolor: 'rgba(17, 24, 39, 0.08)',
                                    rangemode: 'tozero',
                                    tickfont: { color: '#6B7280', size: 11 },
                                    zeroline: false,
                                },
                            }}
                        />
                    )}
                </section>
            </div>

            {selectedIssue ? (
                <IssueDetailDrawer
                    isUpvoted={isUpvoted(selectedIssue.id)}
                    issue={selectedIssue}
                    onClose={() => setSelectedIssueId(null)}
                    onUpvote={() => toggleUpvote(selectedIssue.id)}
                />
            ) : null}
        </div>
    );
}
