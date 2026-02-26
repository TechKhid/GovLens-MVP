'use client';

import {
    mockMPProfile, SECTORS, SECTOR_COLORS, Sector,
} from '@/lib/mockData';

export default function MPProfilePage() {
    const mp = mockMPProfile;
    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    const maxApproval = 100;

    return (
        <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6">
            {/* Header */}
            <div className="card p-6 mb-6">
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary-text rounded-full flex items-center justify-center text-white font-display text-xl font-bold flex-shrink-0">
                        {mp.name.split(' ').slice(-1)[0][0]}
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-bold">{mp.name}</h1>
                        <p className="text-sm text-muted-text font-body mt-1">
                            {mp.constituency} · {mp.party}
                        </p>
                        <p className="text-xs font-mono text-muted-text mt-0.5">{mp.term}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Approval Rating */}
                <div className="card p-5">
                    <h3 className="section-label mb-3">Approval Rating</h3>
                    <div className="flex items-end gap-3 mb-4">
                        <span className="font-mono text-5xl font-bold text-primary-text">
                            {mp.approvalRating}%
                        </span>
                        <span className={`text-sm font-mono mb-2 ${mp.approvalTrend >= 0 ? 'text-status-resolved' : 'text-status-critical'}`}>
                            {mp.approvalTrend >= 0 ? '↑' : '↓'} {Math.abs(mp.approvalTrend)} pts since Aug
                        </span>
                    </div>

                    {/* Mini bar chart */}
                    <div className="flex items-end gap-2 h-20">
                        {mp.approvalHistory.map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full relative" style={{ height: '60px' }}>
                                    <div
                                        className="absolute bottom-0 w-full bg-primary-text bg-opacity-15 transition-all"
                                        style={{ height: `${(val / maxApproval) * 60}px` }}
                                    >
                                        <div
                                            className="absolute bottom-0 w-full bg-primary-text transition-all"
                                            style={{ height: `${(val / maxApproval) * 60 * 0.7}px`, opacity: i === mp.approvalHistory.length - 1 ? 1 : 0.4 }}
                                        />
                                    </div>
                                </div>
                                <span className="text-[9px] font-mono text-muted-text">{months[i]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="card p-5">
                    <h3 className="section-label mb-3">Performance Overview</h3>
                    <div className="space-y-5">
                        <div>
                            <p className="text-xs text-muted-text font-body mb-0.5">Issues Filed</p>
                            <p className="font-mono text-3xl font-bold">{mp.stats.issuesFiled}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text font-body mb-0.5">Resolved</p>
                            <p className="font-mono text-3xl font-bold text-status-resolved">{mp.stats.resolved}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text font-body mb-0.5">Average Response Time</p>
                            <p className="font-mono text-3xl font-bold">{mp.stats.avgResponseTime}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sector Response Rates */}
            <div className="card p-5 mt-6">
                <h3 className="section-label mb-4">Sector Response Rates</h3>
                <div className="space-y-3">
                    {(Object.entries(mp.sectorResponseRates) as [Sector, number][]).map(
                        ([sector, rate]) => {
                            const color = SECTOR_COLORS[sector];
                            return (
                                <div key={sector}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="text-sm font-body">{sector}</span>
                                        </div>
                                        <span className="text-sm font-mono text-muted-text">{rate}%</span>
                                    </div>
                                    <div className="h-2 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${rate}%`, backgroundColor: color }}
                                        />
                                    </div>
                                </div>
                            );
                        }
                    )}
                </div>
            </div>
        </div>
    );
}
