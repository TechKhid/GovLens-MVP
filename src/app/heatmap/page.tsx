'use client';

import { useState, useMemo } from 'react';
import {
    mockIssues, mockZones, ZoneData, SEVERITY_COLORS,
    getZoneSeverity, STATUS_COLORS,
} from '@/lib/mockData';
import StatusPill from '@/components/StatusPill';
import SectorTag from '@/components/SectorTag';
import IssueDetailDrawer from '@/components/IssueDetailDrawer';
import EmptyState from '@/components/EmptyState';

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
                    <svg
                        viewBox="0 0 620 460"
                        className="w-full"
                        style={{ maxHeight: '500px' }}
                    >
                        {/* Background grid */}
                        <defs>
                            <pattern id="heatGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#E5E5E3" strokeWidth="0.3" />
                            </pattern>
                        </defs>
                        <rect width="620" height="460" fill="#F8F8F6" />
                        <rect width="620" height="460" fill="url(#heatGrid)" />

                        {/* Simplified road lines */}
                        <line x1="0" y1="230" x2="620" y2="230" stroke="#E5E5E3" strokeWidth="2" />
                        <line x1="310" y1="0" x2="310" y2="460" stroke="#E5E5E3" strokeWidth="2" />
                        <line x1="0" y1="120" x2="620" y2="350" stroke="#E5E5E3" strokeWidth="1" />
                        <line x1="100" y1="0" x2="520" y2="460" stroke="#E5E5E3" strokeWidth="1" />

                        {/* Dashed coastline suggestion */}
                        <path
                            d="M 580,400 Q 600,350 590,300 Q 610,250 600,200"
                            fill="none"
                            stroke="#E5E5E3"
                            strokeWidth="1.5"
                            strokeDasharray="6,4"
                        />

                        {/* Zone heat blobs and dots */}
                        {mockZones.map((zone) => {
                            const severity = getZoneSeverity(zone.issueCount);
                            const color = SEVERITY_COLORS[severity];
                            const isHovered = hoveredZone === zone.id;
                            const isSelected = selectedZone?.id === zone.id;

                            return (
                                <g
                                    key={zone.id}
                                    className="cursor-pointer"
                                    onClick={() => setSelectedZone(isSelected ? null : zone)}
                                    onMouseEnter={() => setHoveredZone(zone.id)}
                                    onMouseLeave={() => setHoveredZone(null)}
                                >
                                    {/* Heat blob */}
                                    <circle
                                        cx={zone.x}
                                        cy={zone.y}
                                        r={zone.radius}
                                        fill={color}
                                        opacity={0.15}
                                        className="transition-all duration-200"
                                    />
                                    <circle
                                        cx={zone.x}
                                        cy={zone.y}
                                        r={zone.radius * 0.6}
                                        fill={color}
                                        opacity={0.1}
                                    />

                                    {/* Dot marker */}
                                    <circle
                                        cx={zone.x}
                                        cy={zone.y}
                                        r={isHovered || isSelected ? 8 : 5}
                                        fill={isSelected ? '#111111' : color}
                                        className="transition-all duration-200"
                                    />
                                    <circle
                                        cx={zone.x}
                                        cy={zone.y}
                                        r={2}
                                        fill="white"
                                    />

                                    {/* Zone label on hover/select */}
                                    {(isHovered || isSelected) && (
                                        <g>
                                            <rect
                                                x={zone.x - 40}
                                                y={zone.y - zone.radius - 28}
                                                width="80"
                                                height="22"
                                                fill="white"
                                                stroke="#E5E5E3"
                                                strokeWidth="1"
                                                rx="2"
                                            />
                                            <text
                                                x={zone.x}
                                                y={zone.y - zone.radius - 14}
                                                textAnchor="middle"
                                                className="text-[11px] font-body fill-primary-text"
                                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                                            >
                                                {zone.name} ({zone.issueCount})
                                            </text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

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
