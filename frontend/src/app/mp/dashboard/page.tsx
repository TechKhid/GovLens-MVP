'use client';

import { ReactNode, useMemo, useState } from 'react';
import {
    Status,
    Severity,
    Sector,
    STATUSES,
    SEVERITIES,
    SECTORS,
    ZONES,
    STATUS_COLORS,
    SEVERITY_COLORS,
    SECTOR_COLORS,
    formatDate,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import SeverityPill from '@/components/SeverityPill';
import SectorTag from '@/components/SectorTag';
import IssueDetailDrawer from '@/components/IssueDetailDrawer';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/context/RoleContext';
import { matchesConstituencyZone } from '@/lib/geo-scope';
import PlotlyClientChart from '@/components/PlotlyClientChart';

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

export default function MPDashboard() {
    const { issues, toggleUpvote, isUpvoted } = useDataStore();
    const { user } = useAuth();

    const [statusFilters, setStatusFilters] = useState<Set<Status>>(new Set());
    const [sectorFilters, setSectorFilters] = useState<Set<Sector>>(new Set());
    const [severityFilters, setSeverityFilters] = useState<Set<Severity>>(new Set());
    const [zoneFilters, setZoneFilters] = useState<Set<string>>(new Set());
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

    const myIssues = useMemo(() => {
        if (!user || user.role !== 'mp' || !user.constituency) return issues;
        return issues.filter((issue) => matchesConstituencyZone(user.constituency, issue.zone));
    }, [issues, user]);

    const selectedIssue = myIssues.find((issue) => issue.id === selectedIssueId) || null;

    const filteredIssues = useMemo(() => {
        return myIssues.filter((issue) => {
            if (statusFilters.size > 0 && !statusFilters.has(issue.status)) return false;
            if (sectorFilters.size > 0 && !sectorFilters.has(issue.sector)) return false;
            if (severityFilters.size > 0 && !severityFilters.has(issue.severity)) return false;
            if (zoneFilters.size > 0 && !zoneFilters.has(issue.zone)) return false;
            return true;
        });
    }, [myIssues, statusFilters, sectorFilters, severityFilters, zoneFilters]);

    const toggleFilter = <T,>(current: Set<T>, value: T, setter: (next: Set<T>) => void) => {
        const next = new Set(current);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        setter(next);
    };

    const clearAllFilters = () => {
        setStatusFilters(new Set());
        setSectorFilters(new Set());
        setSeverityFilters(new Set());
        setZoneFilters(new Set());
    };

    const hasFilters = statusFilters.size > 0 || sectorFilters.size > 0 || severityFilters.size > 0 || zoneFilters.size > 0;

    const statusChartIssues = useMemo(() => {
        return myIssues.filter((issue) => {
            if (sectorFilters.size > 0 && !sectorFilters.has(issue.sector)) return false;
            if (severityFilters.size > 0 && !severityFilters.has(issue.severity)) return false;
            if (zoneFilters.size > 0 && !zoneFilters.has(issue.zone)) return false;
            return true;
        });
    }, [myIssues, sectorFilters, severityFilters, zoneFilters]);

    const sectorChartIssues = useMemo(() => {
        return myIssues.filter((issue) => {
            if (statusFilters.size > 0 && !statusFilters.has(issue.status)) return false;
            if (severityFilters.size > 0 && !severityFilters.has(issue.severity)) return false;
            if (zoneFilters.size > 0 && !zoneFilters.has(issue.zone)) return false;
            return true;
        });
    }, [myIssues, statusFilters, severityFilters, zoneFilters]);

    const statusChartPoints = useMemo(() => {
        return STATUSES.map((status) => ({
            active: statusFilters.has(status),
            color: STATUS_COLORS[status],
            count: statusChartIssues.filter((issue) => issue.status === status).length,
            status,
        })).filter((point) => point.count > 0);
    }, [statusChartIssues, statusFilters]);

    const sectorChartPoints = useMemo(() => {
        return SECTORS.map((sector) => ({
            active: sectorFilters.has(sector),
            color: SECTOR_COLORS[sector],
            count: sectorChartIssues.filter((issue) => issue.sector === sector).length,
            sector,
        }))
            .filter((point) => point.count > 0)
            .sort((left, right) => right.count - left.count);
    }, [sectorChartIssues, sectorFilters]);

    const sharedChartLayout = useMemo(() => ({
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#4B5563', family: 'system-ui, sans-serif', size: 12 },
        margin: { b: 24, l: 24, r: 24, t: 8 },
    }), []);

    const statusChartData = useMemo(() => ([
        {
            type: 'pie',
            labels: statusChartPoints.map((point) => point.status),
            values: statusChartPoints.map((point) => point.count),
            hole: 0.62,
            sort: false,
            textinfo: 'label+percent',
            textposition: 'inside',
            insidetextorientation: 'horizontal',
            pull: statusChartPoints.map((point) => (point.active ? 0.08 : 0)),
            marker: {
                colors: statusChartPoints.map((point) =>
                    hexToRgba(point.color, statusFilters.size === 0 || point.active ? 0.95 : 0.35)
                ),
                line: { color: '#FFFFFF', width: 2 },
            },
            hovertemplate: '<b>%{label}</b><br>%{value} issues<extra>Click to filter</extra>',
        },
    ]), [statusChartPoints, statusFilters]);

    const statusChartLayout = useMemo(() => ({
        ...sharedChartLayout,
        height: 260,
        margin: { b: 10, l: 10, r: 10, t: 10 },
        showlegend: false,
    }), [sharedChartLayout]);

    const sectorChartData = useMemo(() => ([
        {
            type: 'bar',
            orientation: 'h',
            y: sectorChartPoints.map((point) => point.sector),
            x: sectorChartPoints.map((point) => point.count),
            text: sectorChartPoints.map((point) => point.count),
            textposition: 'outside',
            cliponaxis: false,
            marker: {
                color: sectorChartPoints.map((point) =>
                    hexToRgba(point.color, sectorFilters.size === 0 || point.active ? 0.92 : 0.28)
                ),
                line: {
                    color: sectorChartPoints.map((point) => point.color),
                    width: 1.5,
                },
            },
            hovertemplate: '<b>%{y}</b><br>%{x} issues<extra>Click to filter</extra>',
        },
    ]), [sectorChartPoints, sectorFilters]);

    const sectorChartLayout = useMemo(() => ({
        ...sharedChartLayout,
        height: 260,
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
            tickfont: { color: '#111827', size: 12 },
        },
    }), [sharedChartLayout]);

    const openIssues = myIssues.filter((issue) => issue.status !== 'Verified Resolved').length;
    const ackRate = myIssues.length > 0
        ? Math.round((myIssues.filter((issue) => issue.status !== 'Reported').length / myIssues.length) * 100)
        : 0;
    const resRate = myIssues.length > 0
        ? Math.round((myIssues.filter((issue) => issue.status === 'Verified Resolved').length / myIssues.length) * 100)
        : 0;
    const highPriority = myIssues.filter(
        (issue) => issue.severity === 'Critical' || issue.severity === 'High'
    ).length;

    const getSeverityTint = (severity: Severity): string => {
        switch (severity) {
            case 'Critical':
                return 'rgba(198, 40, 40, 0.05)';
            case 'High':
                return 'rgba(245, 124, 0, 0.05)';
            case 'Medium':
                return 'rgba(245, 166, 35, 0.05)';
            default:
                return 'transparent';
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold">Issue Queue</h1>
                <p className="text-sm text-muted-text font-body mt-1">
                    Manage and respond to constituency issues
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <StatCard label="Total Open" value={openIssues} color="#111111" />
                <StatCard label="Ack. Rate" value={`${ackRate}%`} color="#1E3A8A" />
                <StatCard label="Resolution Rate" value={`${resRate}%`} color="#2E7D32" />
                <StatCard label="Avg Response" value="3.2d" color="#F5A623" />
                <StatCard label="High Priority" value={highPriority} color="#C62828" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <section className="card p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <h2 className="section-label">Status Mix</h2>
                            <p className="text-xs text-muted-text font-body mt-1">
                                Click a slice to filter the queue by accountability state.
                            </p>
                        </div>
                        {statusFilters.size > 0 && (
                            <button
                                onClick={() => setStatusFilters(new Set())}
                                className="text-xs text-briefing-blue font-body hover:underline"
                            >
                                Clear status
                            </button>
                        )}
                    </div>
                    <PlotlyClientChart
                        className="h-[260px]"
                        config={{ displayModeBar: false }}
                        data={statusChartData}
                        layout={statusChartLayout}
                        onPointClick={(point) => {
                            const status = point.label as Status | undefined;
                            if (status) {
                                toggleFilter(statusFilters, status, setStatusFilters);
                            }
                        }}
                    />
                    <p className="text-xs text-muted-text font-body mt-3">
                        Showing {statusChartIssues.length} issues after non-status filters.
                    </p>
                </section>

                <section className="card p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <h2 className="section-label">Sector Pressure</h2>
                            <p className="text-xs text-muted-text font-body mt-1">
                                Hover for counts, then click a bar to narrow the issue queue instantly.
                            </p>
                        </div>
                        {sectorFilters.size > 0 && (
                            <button
                                onClick={() => setSectorFilters(new Set())}
                                className="text-xs text-briefing-blue font-body hover:underline"
                            >
                                Clear sector
                            </button>
                        )}
                    </div>
                    <PlotlyClientChart
                        className="h-[260px]"
                        config={{ displayModeBar: false }}
                        data={sectorChartData}
                        layout={sectorChartLayout}
                        onPointClick={(point) => {
                            const sector = point.y as Sector | undefined;
                            if (sector) {
                                toggleFilter(sectorFilters, sector, setSectorFilters);
                            }
                        }}
                    />
                    <p className="text-xs text-muted-text font-body mt-3">
                        Bars update against your other active filters so MPs can isolate pressure pockets faster.
                    </p>
                </section>
            </div>

            <div className="flex flex-col gap-6 xl:flex-row">
                <aside className="hidden xl:block w-[220px] flex-shrink-0 space-y-5">
                    <FilterBlock label="Status">
                        {STATUSES.map((status) => (
                            <FilterCheckbox
                                key={status}
                                checked={statusFilters.has(status)}
                                color={STATUS_COLORS[status]}
                                label={status}
                                onChange={() => toggleFilter(statusFilters, status, setStatusFilters)}
                            />
                        ))}
                    </FilterBlock>

                    <FilterBlock label="Sector">
                        {SECTORS.map((sector) => (
                            <FilterCheckbox
                                key={sector}
                                checked={sectorFilters.has(sector)}
                                color={SECTOR_COLORS[sector]}
                                label={sector}
                                onChange={() => toggleFilter(sectorFilters, sector, setSectorFilters)}
                            />
                        ))}
                    </FilterBlock>

                    <FilterBlock label="Zone">
                        {ZONES.map((zone) => (
                            <FilterCheckbox
                                key={zone}
                                checked={zoneFilters.has(zone)}
                                label={zone}
                                onChange={() => toggleFilter(zoneFilters, zone, setZoneFilters)}
                            />
                        ))}
                    </FilterBlock>

                    <FilterBlock label="Severity">
                        {SEVERITIES.map((severity) => (
                            <FilterCheckbox
                                key={severity}
                                checked={severityFilters.has(severity)}
                                color={SEVERITY_COLORS[severity]}
                                label={severity}
                                onChange={() => toggleFilter(severityFilters, severity, setSeverityFilters)}
                            />
                        ))}
                    </FilterBlock>

                    <div>
                        <h4 className="section-label mb-2">Date Range</h4>
                        <div className="flex gap-2">
                            <input type="date" aria-label="Start Date" title="Start Date filter" className="input-field text-xs" />
                            <input type="date" aria-label="End Date" title="End Date filter" className="input-field text-xs" />
                        </div>
                    </div>

                    {hasFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-briefing-blue font-body cursor-pointer hover:underline"
                        >
                            Clear all filters
                        </button>
                    )}
                </aside>

                <div className="min-w-0 flex-1 space-y-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-display text-xl font-semibold text-primary-text">Constituency queue</h2>
                            <p className="mt-1 text-sm font-body text-muted-text">
                                Select a case to open the issue drawer.
                            </p>
                        </div>
                        {selectedIssue && (
                            <button
                                onClick={() => setSelectedIssueId(null)}
                                className="text-xs text-briefing-blue font-body hover:underline"
                            >
                                Clear selection
                            </button>
                        )}
                    </div>

                    {filteredIssues.length === 0 ? (
                        <EmptyState
                            message="No issues match the current filters. Try adjusting the sidebar."
                            actionLabel="Clear all filters"
                            onAction={clearAllFilters}
                        />
                    ) : (
                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-background border-b border-border">
                                            <th className="px-3 py-2.5 text-left section-label font-medium">ID</th>
                                            <th className="px-3 py-2.5 text-left section-label font-medium">Title</th>
                                            <th className="px-3 py-2.5 text-left section-label font-medium">Sector</th>
                                            <th className="px-3 py-2.5 text-left section-label font-medium">Zone</th>
                                            <th className="px-3 py-2.5 text-left section-label font-medium">Status</th>
                                            <th className="px-3 py-2.5 text-left section-label font-medium">Severity</th>
                                            <th className="px-3 py-2.5 text-right section-label font-medium">Votes</th>
                                            <th className="px-3 py-2.5 text-right section-label font-medium">Affected</th>
                                            <th className="px-3 py-2.5 text-right section-label font-medium">Submitted</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filteredIssues.map((issue) => {
                                            const isSelected = issue.id === selectedIssueId;

                                            return (
                                                <tr
                                                    key={issue.id}
                                                    onClick={() => setSelectedIssueId(issue.id)}
                                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-amber-50/70' : 'hover:bg-background'}`}
                                                    style={{
                                                        backgroundColor: isSelected ? 'rgba(245, 166, 35, 0.08)' : getSeverityTint(issue.severity),
                                                        boxShadow: isSelected ? 'inset 4px 0 0 #111111' : 'none',
                                                    }}
                                                >
                                                    <td className="px-3 py-2.5 font-mono text-xs text-muted-text whitespace-nowrap">
                                                        {issue.id}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-body font-medium max-w-[200px] truncate">
                                                        {issue.title}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <SectorTag sector={issue.sector} />
                                                    </td>
                                                    <td className="px-3 py-2.5 font-body text-xs text-muted-text whitespace-nowrap">
                                                        {issue.zone}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <StatusPill status={issue.status} />
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <SeverityPill severity={issue.severity} />
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-text">
                                                        {issue.upvotes}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-text">
                                                        {issue.affectedResidents.toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-text whitespace-nowrap">
                                                        {formatDate(issue.submittedAt)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedIssue && (
                <IssueDetailDrawer
                    issue={selectedIssue}
                    onClose={() => setSelectedIssueId(null)}
                    isUpvoted={isUpvoted(selectedIssue.id)}
                    onUpvote={() => toggleUpvote(selectedIssue.id)}
                />
            )}
        </div>
    );
}

function FilterBlock({ children, label }: { children: ReactNode; label: string }) {
    return (
        <div>
            <h4 className="section-label mb-2">{label}</h4>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function FilterCheckbox({
    checked,
    color,
    label,
    onChange,
}: {
    checked: boolean;
    color?: string;
    label: string;
    onChange: () => void;
}) {
    return (
        <label className="flex items-center gap-2 py-1 cursor-pointer text-sm font-body hover:text-primary-text">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="accent-primary-text"
            />
            {color && (
                <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0">
                    <circle cx="4" cy="4" r="4" fill={color} />
                </svg>
            )}
            {label}
        </label>
    );
}
