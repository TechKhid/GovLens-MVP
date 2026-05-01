'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ZoneData, SEVERITY_COLORS, getZoneSeverity } from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth } from '@/context/RoleContext';
import { matchesConstituencyZone } from '@/lib/geo-scope';
import StatusPill from '@/components/StatusPill';
import SectorTag from '@/components/SectorTag';
import IssueDetailDrawer from '@/components/IssueDetailDrawer';
import EmptyState from '@/components/EmptyState';

const IssueHeatmapMap = dynamic(() => import('@/components/IssueHeatmapMap'), {
    ssr: false,
    loading: () => (
        <div className="flex w-full items-center justify-center rounded-lg bg-background" style={{ height: '500px' }}>
            <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary-text border-t-transparent" />
                <span className="text-sm text-muted-text font-body">Loading map...</span>
            </div>
        </div>
    ),
});

export default function HeatmapPage() {
    const { user } = useAuth();
    const { issues, zones, toggleUpvote, isUpvoted } = useDataStore();
    const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

    const scopedIssues = useMemo(() => {
        if (!user?.constituency) return issues;
        return issues.filter((issue) => matchesConstituencyZone(user.constituency, issue.zone));
    }, [issues, user?.constituency]);

    const scopedZones = useMemo(() => {
        if (!user?.constituency) return zones;
        return zones.filter((zone) => matchesConstituencyZone(user.constituency, zone.name));
    }, [user?.constituency, zones]);

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

    const selectedIssue = scopedIssues.find((issue) => issue.id === selectedIssueId) || null;

    const zoneIssues = useMemo(() => {
        if (!selectedZone) return [];
        return scopedIssues.filter((issue) => issue.zone === selectedZone.name);
    }, [scopedIssues, selectedZone]);

    return (
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold">Constituency Heatmap</h1>
                <p className="mt-1 text-sm text-muted-text font-body">
                    Issue density and severity across {user?.constituency || 'Ghana'} zones
                </p>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row">
                <div className="card flex-1 p-4">
                    <IssueHeatmapMap
                        constituency={user?.constituency ?? ''}
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
                        <span>Issue pins appear after selecting a hotspot</span>
                    </div>
                </div>

                <aside className="w-full flex-shrink-0 lg:w-[300px]">
                    {!selectedZone ? (
                        <div className="card">
                            <div className="border-b border-border px-4 py-3">
                                <h4 className="section-label">Zones by Issue Count</h4>
                            </div>
                            {scopedZones.length === 0 ? (
                                <div className="px-4 py-8">
                                    <EmptyState message="No issues have been reported in this constituency yet." />
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {[...scopedZones]
                                        .sort((left, right) => right.issueCount - left.issueCount)
                                        .map((zone) => {
                                            const severity = getZoneSeverity(zone.issueCount);
                                            const color = SEVERITY_COLORS[severity];

                                            return (
                                                <button
                                                    key={zone.id}
                                                    className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-background"
                                                    onClick={() => setSelectedZone(zone)}
                                                    type="button"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <svg aria-hidden="true" height="10" viewBox="0 0 10 10" width="10">
                                                            <circle cx="5" cy="5" fill={color} r="5" />
                                                        </svg>
                                                        <span className="text-sm font-body">{zone.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-muted-text font-mono">{zone.issueCount}</span>
                                                        <span className="text-xs text-muted-text">›</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card">
                            <div className="border-b border-border px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-display text-lg font-semibold">{selectedZone.name}</h4>
                                    <button
                                        className="cursor-pointer text-xs text-muted-text hover:text-primary-text"
                                        onClick={() => setSelectedZone(null)}
                                        type="button"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="mt-2 flex items-center gap-4">
                                    <div>
                                        <span className="text-xs text-muted-text font-body">Open</span>
                                        <p className="text-lg font-semibold font-mono">{selectedZone.issueCount - selectedZone.resolvedCount}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-text font-body">Verified Resolved</span>
                                        <p className="text-status-resolved text-lg font-semibold font-mono">{selectedZone.resolvedCount}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-text font-body">Rate</span>
                                        <p className="text-lg font-semibold font-mono">
                                            {Math.round((selectedZone.resolvedCount / selectedZone.issueCount) * 100)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-border">
                                {zoneIssues.length === 0 ? (
                                    <div className="px-4 py-6">
                                        <EmptyState message="No issues logged for this zone yet." />
                                    </div>
                                ) : (
                                    zoneIssues.map((issue) => (
                                        <button
                                            key={issue.id}
                                            className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-background"
                                            onClick={() => setSelectedIssueId(issue.id)}
                                            type="button"
                                        >
                                            <p className="mb-1 line-clamp-1 text-sm font-medium font-body">{issue.title}</p>
                                            <div className="flex items-center gap-2">
                                                <SectorTag sector={issue.sector} />
                                                <StatusPill status={issue.status} />
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {selectedIssue && (
                <IssueDetailDrawer
                    isUpvoted={isUpvoted(selectedIssue.id)}
                    issue={selectedIssue}
                    onClose={() => setSelectedIssueId(null)}
                    onUpvote={() => toggleUpvote(selectedIssue.id)}
                />
            )}
        </div>
    );
}
