'use client';

import { useState, useMemo } from 'react';
import {
    Status, Sector, SECTORS, SECTOR_COLORS,
    STATUS_COLORS, STATUSES,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import IssueCard from '@/components/IssueCard';
import IssueDetailDrawer from '@/components/IssueDetailDrawer';
import FilterBar from '@/components/FilterBar';
import ReportModal from '@/components/ReportModal';
import EmptyState from '@/components/EmptyState';

export default function IssueTracker() {
    const { issues, toggleUpvote, isUpvoted, upvotedIds } = useDataStore();
    const [activeFilter, setActiveFilter] = useState<Status | 'All'>('All');
    const [activeSector, setActiveSector] = useState<Sector | null>(null);
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
    const [showReportModal, setShowReportModal] = useState(false);

    const filteredIssues = useMemo(() => {
        return issues.filter((issue) => {
            if (activeFilter !== 'All' && issue.status !== activeFilter) return false;
            if (activeSector && issue.sector !== activeSector) return false;
            return true;
        });
    }, [issues, activeFilter, activeSector]);

    const selectedIssue = issues.find((i) => i.id === selectedIssueId) || null;

    // Status counts
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: issues.length };
        STATUSES.forEach((s) => {
            counts[s] = issues.filter((i) => i.status === s).length;
        });
        return counts;
    }, [issues]);

    // Sector breakdown
    const sectorBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        SECTORS.forEach((s) => {
            counts[s] = issues.filter((i) => i.sector === s).length;
        });
        return counts;
    }, [issues]);

    const maxSectorCount = Math.max(...Object.values(sectorBreakdown));



    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            {/* Page header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="font-display text-2xl font-bold">Issue Tracker</h1>
                    <p className="text-sm text-muted-text font-body mt-1">
                        Community issues reported by citizens of Ayawaso West Wuogon
                    </p>
                </div>
                <button
                    onClick={() => setShowReportModal(true)}
                    className="btn-primary hidden md:block"
                >
                    + Report Issue
                </button>
            </div>

            {/* Filter bar */}
            <div className="mb-5">
                <FilterBar
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                    counts={statusCounts}
                />
            </div>

            <div className="flex gap-6">
                {/* Main feed */}
                <div className="flex-1 min-w-0">
                    {filteredIssues.length === 0 ? (
                        <EmptyState
                            message="No issues found for this filter."
                            actionLabel="Clear filters"
                            onAction={() => { setActiveFilter('All'); setActiveSector(null); }}
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredIssues.map((issue) => (
                                <IssueCard
                                    key={issue.id}
                                    issue={issue}
                                    onClick={() => setSelectedIssueId(issue.id)}
                                    onUpvote={() => toggleUpvote(issue.id)}
                                    isUpvoted={isUpvoted(issue.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Sidebar */}
                <aside className="hidden lg:block w-[280px] flex-shrink-0 space-y-6">
                    {/* Sector Breakdown */}
                    <div className="card p-4">
                        <h4 className="section-label mb-3">Sector Breakdown</h4>
                        <div className="space-y-2.5">
                            {SECTORS.map((sector) => {
                                const count = sectorBreakdown[sector];
                                const color = SECTOR_COLORS[sector];
                                const widthPct = maxSectorCount > 0 ? (count / maxSectorCount) * 100 : 0;
                                const isActive = activeSector === sector;

                                return (
                                    <button
                                        key={sector}
                                        onClick={() => setActiveSector(isActive ? null : sector)}
                                        className={`w-full text-left cursor-pointer group transition-opacity ${activeSector && !isActive ? 'opacity-40' : ''
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                />
                                                <span className="text-xs font-body">{sector}</span>
                                            </div>
                                            <span className="text-xs font-mono text-muted-text">{count}</span>
                                        </div>
                                        <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${widthPct}%`, backgroundColor: color }}
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {activeSector && (
                            <button
                                onClick={() => setActiveSector(null)}
                                className="text-xs text-briefing-blue font-body mt-3 cursor-pointer hover:underline"
                            >
                                Clear sector filter
                            </button>
                        )}
                    </div>

                    {/* Status Summary */}
                    <div className="card p-4">
                        <h4 className="section-label mb-3">Status Summary</h4>
                        <div className="space-y-2">
                            {STATUSES.map((status) => (
                                <div key={status} className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: STATUS_COLORS[status] }}
                                        />
                                        <span className="text-xs font-body">{status}</span>
                                    </div>
                                    <span className="text-xs font-mono text-muted-text">
                                        {statusCounts[status]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Mobile FAB */}
            <button
                onClick={() => setShowReportModal(true)}
                className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary-text text-white rounded-full flex items-center justify-center text-2xl shadow-lg z-20 cursor-pointer"
            >
                +
            </button>

            {/* Detail Drawer */}
            {selectedIssue && (
                <IssueDetailDrawer
                    issue={selectedIssue}
                    onClose={() => setSelectedIssueId(null)}
                    isUpvoted={selectedIssue ? isUpvoted(selectedIssue.id) : false}
                    onUpvote={() => selectedIssue && toggleUpvote(selectedIssue.id)}
                />
            )}

            {/* Report Modal */}
            <ReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
            />
        </div>
    );
}
