'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
    mockIssues, mockZones, ZoneData, SEVERITY_COLORS,
    getZoneSeverity, STATUS_COLORS,
} from '@/lib/mockData';
import StatusPill from '@/components/StatusPill';
import SectorTag from '@/components/SectorTag';
import IssueDetailDrawer from '@/components/IssueDetailDrawer';
import EmptyState from '@/components/EmptyState';

// Dynamic import — Leaflet needs `window`, so disable SSR
const LeafletMap = dynamic(() => import('@/components/LeafletMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full rounded-lg bg-background flex items-center justify-center" style={{ height: '500px' }}>
            <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary-text border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <span className="text-sm text-muted-text font-body">Loading map…</span>
            </div>
        </div>
    ),
});

export default function HeatmapPage() {
    const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
    const [hoveredZone, setHoveredZone] = useState<string | null>(null);
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

    const selectedIssue = mockIssues.find((i) => i.id === selectedIssueId) || null;

    const zoneIssues = useMemo(() => {
        if (!selectedZone) return [];
        return mockIssues.filter((i) => i.zone === selectedZone.name);
    }, [selectedZone]);

    const severityLegend = [
        { label: 'Low (< 35)', color: SEVERITY_COLORS['Low'] },
        { label: 'Medium (35–49)', color: SEVERITY_COLORS['Medium'] },
        { label: 'High (50–69)', color: SEVERITY_COLORS['High'] },
        { label: 'Critical (70+)', color: SEVERITY_COLORS['Critical'] },
    ];

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold">Constituency Heatmap</h1>
                <p className="text-sm text-muted-text font-body mt-1">
                    Issue density and severity across Ayawaso West Wuogon zones
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Map */}
                <div className="flex-1 card p-4">
                    <LeafletMap
                        issues={mockIssues}
                        zones={mockZones}
                        selectedZone={selectedZone}
                        onZoneSelect={setSelectedZone}
                        onIssueSelect={setSelectedIssueId}
                    />

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                        <span className="text-xs text-muted-text font-body">Severity:</span>
                        {severityLegend.map(({ label, color }) => (
                            <div key={label} className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-[10px] font-body text-muted-text">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar */}
                <aside className="w-full lg:w-[300px] flex-shrink-0">
                    {!selectedZone ? (
                        /* Default: ranked zone list */
                        <div className="card">
                            <div className="px-4 py-3 border-b border-border">
                                <h4 className="section-label">Zones by Issue Count</h4>
                            </div>
                            <div className="divide-y divide-border">
                                {[...mockZones]
                                    .sort((a, b) => b.issueCount - a.issueCount)
                                    .map((zone) => {
                                        const severity = getZoneSeverity(zone.issueCount);
                                        const color = SEVERITY_COLORS[severity];
                                        return (
                                            <button
                                                key={zone.id}
                                                onClick={() => setSelectedZone(zone)}
                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-background transition-colors cursor-pointer text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                                    <span className="text-sm font-body">{zone.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-mono text-muted-text">{zone.issueCount}</span>
                                                    <span className="text-muted-text text-xs">›</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    ) : (
                        /* Zone selected */
                        <div className="card">
                            <div className="px-4 py-3 border-b border-border">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-display text-lg font-semibold">{selectedZone.name}</h4>
                                    <button
                                        onClick={() => setSelectedZone(null)}
                                        className="text-xs text-muted-text hover:text-primary-text cursor-pointer"
                                    >
                                        ✕ Clear
                                    </button>
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                    <div>
                                        <span className="text-xs text-muted-text font-body">Open</span>
                                        <p className="font-mono text-lg font-semibold">{selectedZone.issueCount - selectedZone.resolvedCount}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-text font-body">Resolved</span>
                                        <p className="font-mono text-lg font-semibold text-status-resolved">{selectedZone.resolvedCount}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-text font-body">Rate</span>
                                        <p className="font-mono text-lg font-semibold">
                                            {Math.round((selectedZone.resolvedCount / selectedZone.issueCount) * 100)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Zone issues */}
                            <div className="divide-y divide-border">
                                {zoneIssues.length === 0 ? (
                                    <div className="px-4 py-6">
                                        <EmptyState message="No issues logged for this zone yet." />
                                    </div>
                                ) : (
                                    zoneIssues.map((issue) => (
                                        <button
                                            key={issue.id}
                                            onClick={() => setSelectedIssueId(issue.id)}
                                            className="w-full px-4 py-3 text-left hover:bg-background transition-colors cursor-pointer"
                                        >
                                            <p className="text-sm font-body font-medium mb-1 line-clamp-1">{issue.title}</p>
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

            {/* Issue Detail Drawer */}
            {selectedIssue && (
                <IssueDetailDrawer
                    issue={selectedIssue}
                    onClose={() => setSelectedIssueId(null)}
                />
            )}
        </div>
    );
}
