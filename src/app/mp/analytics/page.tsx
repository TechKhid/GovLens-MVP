'use client';

import {
    mockIssues, mockZones, SECTORS, SECTOR_COLORS, SEVERITY_COLORS,
    Sector, getZoneSeverity,
} from '@/lib/mockData';
import StatCard from '@/components/StatCard';

export default function AnalyticsPage() {
    // Sector distribution
    const sectorCounts: Record<string, number> = {};
    SECTORS.forEach((s) => {
        sectorCounts[s] = mockIssues.filter((i) => i.sector === s).length;
    });
    const maxSectorCount = Math.max(...Object.values(sectorCounts));

    // Zone performance
    const zonePerformance = mockZones.map((z) => ({
        name: z.name,
        total: z.issueCount,
        resolved: z.resolvedCount,
        rate: Math.round((z.resolvedCount / z.issueCount) * 100),
        severity: getZoneSeverity(z.issueCount),
    }));

    // Time-to-resolution trend (mock 6-month data)
    const trendMonths = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    const trendValues = [5.8, 5.2, 4.7, 4.1, 3.8, 3.2]; // Days
    const maxTrend = Math.max(...trendValues);

    // Recurring issues
    const recurringIssues = [
        { sector: 'Drainage' as Sector, count: 12, description: 'Flooding reports during rainy periods in East Legon and Okponglo' },
        { sector: 'Sanitation' as Sector, count: 9, description: 'Waste collection delays in Airport Residential area' },
        { sector: 'Infrastructure' as Sector, count: 7, description: 'Recurring streetlight outages across multiple zones' },
        { sector: 'Water' as Sector, count: 5, description: 'Intermittent water supply in Dzorwulu residential areas' },
    ];

    // At-risk zones
    const atRiskZones = zonePerformance
        .filter((z) => z.rate < 50 || z.severity === 'Critical' || z.severity === 'High')
        .sort((a, b) => a.rate - b.rate);

    // AI Insight cards
    const insights = [
        {
            icon: '🌧️',
            label: 'Drainage Crisis Escalating',
            color: SEVERITY_COLORS['Critical'],
            text: 'Drainage issues in East Legon and Okponglo increased 34% in 30 days. Rainy season risk is elevated. Recommend pre-emptive drain clearing in flood-prone corridors.',
        },
        {
            icon: '⚡',
            label: 'Infrastructure Response Gap',
            color: SEVERITY_COLORS['High'],
            text: 'Average acknowledgement time for Infrastructure issues is 2.1 days — 40% slower than Education. ECG coordination is the primary bottleneck.',
        },
        {
            icon: '📍',
            label: 'East Legon Zone Overload',
            color: SEVERITY_COLORS['Critical'],
            text: 'East Legon accounts for 33% of all open issues but only 17% of resolutions. Staff reallocation to East Legon this week could reduce backlog by an estimated 15 issues.',
        },
        {
            icon: '✅',
            label: 'Dzorwulu Model Success',
            color: SEVERITY_COLORS['Low'],
            text: 'Dzorwulu has the highest resolution rate at 67%. Direct GWCL engagement pattern could be replicated for Water issues in other zones.',
        },
    ];

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold">Analytics & Intelligence</h1>
                <p className="text-sm text-muted-text font-body mt-1">
                    Decision support for resource allocation and governance priorities
                </p>
            </div>

            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard label="Total Issues" value={mockIssues.length} color="#111111" />
                <StatCard
                    label="Resolution Rate"
                    value={`${Math.round((mockIssues.filter((i) => i.status === 'Resolved').length / mockIssues.length) * 100)}%`}
                    color="#2E7D32"
                />
                <StatCard label="Avg Response" value="3.2d" color="#F5A623" />
                <StatCard
                    label="Critical Issues"
                    value={mockIssues.filter((i) => i.severity === 'Critical').length}
                    color="#C62828"
                />
            </div>

            {/* AI Insight Cards */}
            <div className="mb-6">
                <h3 className="section-label mb-3">AI-Generated Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {insights.map((insight, i) => (
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sector Distribution */}
                <div className="card p-5">
                    <h3 className="section-label mb-4">Sector Distribution</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        Where are the most issues concentrated?
                    </p>
                    <div className="space-y-3">
                        {SECTORS.map((sector) => {
                            const count = sectorCounts[sector];
                            const color = SECTOR_COLORS[sector];
                            const widthPct = maxSectorCount > 0 ? (count / maxSectorCount) * 100 : 0;
                            return (
                                <div key={sector}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                            <span className="text-sm font-body">{sector}</span>
                                        </div>
                                        <span className="text-sm font-mono text-muted-text">{count}</span>
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
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: SEVERITY_COLORS[zone.severity] }}
                                            />
                                            <span className="text-sm font-body">{zone.name}</span>
                                        </div>
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
                                                backgroundColor: zone.rate < 40 ? SEVERITY_COLORS['Critical'] : zone.rate < 60 ? SEVERITY_COLORS['Medium'] : SEVERITY_COLORS['Low'],
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Time-to-Resolution Trend */}
                <div className="card p-5">
                    <h3 className="section-label mb-4">Time-to-Resolution Trend</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        Is the office getting faster or slower?
                    </p>
                    <div className="flex items-end gap-3 h-36">
                        {trendMonths.map((month, i) => {
                            const val = trendValues[i];
                            const heightPct = (val / maxTrend) * 100;
                            const isLatest = i === trendMonths.length - 1;
                            return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-muted-text">{val}d</span>
                                    <div className="w-full relative" style={{ height: '80px' }}>
                                        <div
                                            className={`absolute bottom-0 w-full rounded-t transition-all ${isLatest ? 'bg-status-resolved' : 'bg-primary-text'
                                                }`}
                                            style={{ height: `${heightPct * 0.8}%`, opacity: isLatest ? 1 : 0.2 + (i * 0.12) }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-muted-text">{month}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <span className="text-xs font-mono text-status-resolved">↓ 2.6 days</span>
                        <span className="text-xs text-muted-text font-body">improvement over 6 months</span>
                    </div>
                </div>

                {/* Recurring Issues */}
                <div className="card p-5">
                    <h3 className="section-label mb-4">Recurring Issue Patterns</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        What keeps coming back that needs a systemic fix?
                    </p>
                    <div className="space-y-3">
                        {recurringIssues.map((item, i) => (
                            <div
                                key={i}
                                className="p-3 bg-background rounded"
                                style={{ borderLeft: `3px solid ${SECTOR_COLORS[item.sector]}` }}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: SECTOR_COLORS[item.sector] }}
                                        />
                                        <span className="text-sm font-body font-medium">{item.sector}</span>
                                    </div>
                                    <span className="text-xs font-mono text-muted-text">{item.count} reports</span>
                                </div>
                                <p className="text-xs text-muted-text font-body">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* At-Risk Zones */}
            {atRiskZones.length > 0 && (
                <div className="card p-5 mt-6">
                    <h3 className="section-label mb-3">At-Risk Zone Flags</h3>
                    <p className="text-xs text-muted-text font-body mb-4">
                        Where should you deploy resources this week?
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {atRiskZones.map((zone) => (
                            <div
                                key={zone.name}
                                className="p-3 border border-border"
                                style={{ borderTopWidth: '3px', borderTopColor: SEVERITY_COLORS[zone.severity] }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: SEVERITY_COLORS[zone.severity] }}
                                    />
                                    <span className="font-body font-medium text-sm">{zone.name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-text font-body">
                                    <span>{zone.total} issues</span>
                                    <span>·</span>
                                    <span className="font-mono">{zone.rate}% resolved</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
