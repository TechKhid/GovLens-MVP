'use client';

import { useState, useMemo } from 'react';
import {
    Status, Severity, Sector, Issue,
    STATUSES, SEVERITIES, SECTORS, ZONES,
    STATUS_COLORS, SEVERITY_COLORS, SECTOR_COLORS,
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

export default function MPDashboard() {
    const { issues, toggleUpvote, isUpvoted } = useDataStore();
    const { user } = useAuth();
    
    const [statusFilters, setStatusFilters] = useState<Set<Status>>(new Set());
    const [sectorFilters, setSectorFilters] = useState<Set<Sector>>(new Set());
    const [severityFilters, setSeverityFilters] = useState<Set<Severity>>(new Set());
    const [zoneFilters, setZoneFilters] = useState<Set<string>>(new Set());
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

    // Filter issues tightly so MPs only see their own constituency's issues
    const myIssues = useMemo(() => {
        if (!user || user.role !== 'mp' || !user.constituency) return issues;
        return issues.filter((i) => matchesConstituencyZone(user.constituency, i.zone));
    }, [issues, user]);

    const selectedIssue = myIssues.find((i) => i.id === selectedIssueId) || null;

    const filteredIssues = useMemo(() => {
        return myIssues.filter((issue) => {
            if (statusFilters.size > 0 && !statusFilters.has(issue.status)) return false;
            if (sectorFilters.size > 0 && !sectorFilters.has(issue.sector)) return false;
            if (severityFilters.size > 0 && !severityFilters.has(issue.severity)) return false;
            if (zoneFilters.size > 0 && !zoneFilters.has(issue.zone)) return false;
            return true;
        });
    }, [myIssues, statusFilters, sectorFilters, severityFilters, zoneFilters]);

    const toggleFilter = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
        const next = new Set(set);
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

    // Stats
    const openIssues = myIssues.filter((i) => i.status !== 'Resolved').length;
    const ackRate = myIssues.length > 0 ? Math.round(
        (myIssues.filter((i) => i.status !== 'Reported').length / myIssues.length) * 100
    ) : 0;
    const resRate = myIssues.length > 0 ? Math.round(
        (myIssues.filter((i) => i.status === 'Resolved').length / myIssues.length) * 100
    ) : 0;
    const highPriority = myIssues.filter(
        (i) => i.severity === 'Critical' || i.severity === 'High'
    ).length;

    const getSeverityTint = (severity: Severity): string => {
        switch (severity) {
            case 'Critical': return 'rgba(198, 40, 40, 0.05)';
            case 'High': return 'rgba(245, 124, 0, 0.05)';
            case 'Medium': return 'rgba(245, 166, 35, 0.05)';
            default: return 'transparent';
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

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <StatCard label="Total Open" value={openIssues} color="#111111" />
                <StatCard label="Ack. Rate" value={`${ackRate}%`} color="#1E3A8A" />
                <StatCard label="Resolution Rate" value={`${resRate}%`} color="#2E7D32" />
                <StatCard label="Avg Response" value="3.2d" color="#F5A623" />
                <StatCard label="High Priority" value={highPriority} color="#C62828" />
            </div>

            <div className="flex gap-6">
                {/* Left Filter Sidebar */}
                <aside className="hidden lg:block w-[220px] flex-shrink-0 space-y-5">
                    {/* Status */}
                    <div>
                        <h4 className="section-label mb-2">Status</h4>
                        <div className="space-y-1">
                            {STATUSES.map((s) => (
                                <label
                                    key={s}
                                    className="flex items-center gap-2 py-1 cursor-pointer text-sm font-body hover:text-primary-text"
                                >
                                    <input
                                        type="checkbox"
                                        checked={statusFilters.has(s)}
                                        onChange={() => toggleFilter(statusFilters, s, setStatusFilters)}
                                        className="accent-primary-text"
                                    />
                                    <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0">
                                        <circle cx="4" cy="4" r="4" fill={STATUS_COLORS[s]} />
                                    </svg>
                                    {s}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Sector */}
                    <div>
                        <h4 className="section-label mb-2">Sector</h4>
                        <div className="space-y-1">
                            {SECTORS.map((s) => (
                                <label
                                    key={s}
                                    className="flex items-center gap-2 py-1 cursor-pointer text-sm font-body hover:text-primary-text"
                                >
                                    <input
                                        type="checkbox"
                                        checked={sectorFilters.has(s)}
                                        onChange={() => toggleFilter(sectorFilters, s, setSectorFilters)}
                                        className="accent-primary-text"
                                    />
                                    <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0">
                                        <circle cx="4" cy="4" r="4" fill={SECTOR_COLORS[s]} />
                                    </svg>
                                    {s}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Zone */}
                    <div>
                        <h4 className="section-label mb-2">Zone</h4>
                        <div className="space-y-1">
                            {ZONES.map((z) => (
                                <label
                                    key={z}
                                    className="flex items-center gap-2 py-1 cursor-pointer text-sm font-body hover:text-primary-text"
                                >
                                    <input
                                        type="checkbox"
                                        checked={zoneFilters.has(z)}
                                        onChange={() => toggleFilter(zoneFilters, z, setZoneFilters)}
                                        className="accent-primary-text"
                                    />
                                    {z}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Severity */}
                    <div>
                        <h4 className="section-label mb-2">Severity</h4>
                        <div className="space-y-1">
                            {SEVERITIES.map((s) => (
                                <label
                                    key={s}
                                    className="flex items-center gap-2 py-1 cursor-pointer text-sm font-body hover:text-primary-text"
                                >
                                    <input
                                        type="checkbox"
                                        checked={severityFilters.has(s)}
                                        onChange={() => toggleFilter(severityFilters, s, setSeverityFilters)}
                                        className="accent-primary-text"
                                    />
                                    <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0">
                                        <circle cx="4" cy="4" r="4" fill={SEVERITY_COLORS[s]} />
                                    </svg>
                                    {s}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Date range placeholder */}
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

                {/* Table */}
                <div className="flex-1 min-w-0">
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
                                        {filteredIssues.map((issue) => (
                                            <tr
                                                key={issue.id}
                                                onClick={() => setSelectedIssueId(issue.id)}
                                                className="cursor-pointer hover:bg-background transition-colors"
                                                style={{ backgroundColor: getSeverityTint(issue.severity) }}
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Issue Detail Drawer */}
            {selectedIssue && (
                <IssueDetailDrawer
                    issue={selectedIssue}
                    onClose={() => setSelectedIssueId(null)}
                    isUpvoted={selectedIssue ? isUpvoted(selectedIssue.id) : false}
                    onUpvote={() => selectedIssue && toggleUpvote(selectedIssue.id)}
                />
            )}
        </div>
    );
}
