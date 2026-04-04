'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { SECTOR_COLORS, Sector } from '@/lib/mockData';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MPPublicProfileResponse {
    id: string;
    name: string;
    constituency: string;
    party: string;
    term_start: string;
    term_end: string;
    bio: string;
    phone: string;
    office_addr: string;
    photo_url: string;
}

interface IssueStats {
    total: number;
    open: number;
    resolved: number;
    in_progress: number;
}

// Fixed performance data (would come from analytics endpoint in full version)
const SECTOR_RATES: [Sector, number][] = [
    ['Infrastructure', 85],
    ['Roads', 78],
    ['Water', 82],
    ['Education', 90],
    ['Sanitation', 71],
    ['Drainage', 64],
    ['Security', 55],
];

const APPROVAL_HISTORY = [58, 62, 65, 68, 66, 72];
const APPROVAL_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MPProfilePage() {
    const [mpProfile, setMpProfile] = useState<MPPublicProfileResponse | null>(null);
    const [stats, setStats] = useState<IssueStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                // Get current user to determine their constituency
                const user = getCurrentUser();
                const userConstituency = user?.constituency || 'Ayawaso West Wuogon';

                // Fetch the constituency MP's profile
                const profile = await api.get<MPPublicProfileResponse>(`/mp/public-profile?constituency=${encodeURIComponent(userConstituency)}`);
                setMpProfile(profile);

                // Fetch issue analytics for stats
                try {
                    const overview = await api.get<IssueStats>('/analytics/overview');
                    setStats(overview);
                } catch {
                    // Non-critical — use defaults
                    setStats({ total: 168, open: 89, resolved: 45, in_progress: 34 });
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load profile');
                setMpProfile(null);
                setStats(null);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6">
                <div className="card p-6 mb-6 animate-pulse">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-background rounded-full" />
                        <div className="space-y-2 flex-1">
                            <div className="h-6 bg-background w-48 rounded" />
                            <div className="h-4 bg-background w-64 rounded" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card p-5 h-40 animate-pulse bg-background" />
                    <div className="card p-5 h-40 animate-pulse bg-background" />
                </div>
            </div>
        );
    }

    if (!mpProfile) {
        return (
            <div className="max-w-[900px] mx-auto px-4 md:px-6 py-12 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center text-3xl mb-4">
                    🏛️
                </div>
                <h2 className="font-display text-2xl font-bold mb-2">No MP Registered</h2>
                <p className="text-muted-text font-body max-w-md">
                    There is currently no Member of Parliament registered for your constituency. Encourage your local representative to join GovLens to connect with constituents.
                </p>
            </div>
        );
    }

    const mp = mpProfile;
    const initials = mp.name.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase();
    const resolvedCount = stats?.resolved ?? 0;
    const totalCount = stats?.total ?? 0;
    const approvalRating = 72;
    const approvalTrend = 6;

    return (
        <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6">
            {error && (
                <div className="mb-4 px-3 py-2 bg-yellow-50 border border-yellow-200 text-xs text-yellow-800 font-body">
                    Note: showing cached data — {error}
                </div>
            )}

            {/* Header */}
            <div className="card p-6 mb-6">
                <div className="flex items-start gap-4">
                    <div className="w-28 h-28 rounded-full flex-shrink-0 relative overflow-hidden bg-primary-text flex items-center justify-center">
                        {mp.photo_url ? (
                            <Image
                                src={mp.photo_url}
                                alt={mp.name}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <span className="text-white font-display text-3xl font-bold">
                                {initials}
                            </span>
                        )}
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-bold">{mp.name}</h1>
                        <p className="text-sm text-muted-text font-body mt-1">
                            {mp.constituency} {mp.party && `· ${mp.party}`}
                        </p>
                        {mp.term_start && mp.term_end && (
                            <p className="text-xs font-mono text-muted-text mt-0.5">
                                {mp.term_start} – {mp.term_end}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Bio Section */}
            {mp.bio && (
                <div className="card p-6 mb-6">
                    <h3 className="section-label mb-3">Biography</h3>
                    <p className="font-body text-sm text-primary-text leading-relaxed">
                        {mp.bio}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Approval Rating */}
                <div className="card p-5">
                    <h3 className="section-label mb-3">Approval Rating</h3>
                    <div className="flex items-end gap-3 mb-4">
                        <span className="font-mono text-5xl font-bold text-primary-text">
                            {approvalRating}%
                        </span>
                        <span className={`text-sm font-mono mb-2 ${approvalTrend >= 0 ? 'text-status-resolved' : 'text-status-critical'}`}>
                            {approvalTrend >= 0 ? '↑' : '↓'} {Math.abs(approvalTrend)} pts since Aug
                        </span>
                    </div>
                    <div className="flex items-end gap-2 h-20">
                        {APPROVAL_HISTORY.map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full relative h-[60px]">
                                    <div
                                        className="absolute bottom-0 w-full bg-primary-text bg-opacity-15 transition-all"
                                        style={{ height: `${(val / 100) * 60}px` }}
                                    >
                                        <div
                                            className="absolute bottom-0 w-full bg-primary-text transition-all"
                                            style={{
                                                height: `${(val / 100) * 60 * 0.7}px`,
                                                opacity: i === APPROVAL_HISTORY.length - 1 ? 1 : 0.4,
                                            }}
                                        />
                                    </div>
                                </div>
                                <span className="text-[9px] font-mono text-muted-text">{APPROVAL_MONTHS[i]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className="card p-5">
                    <h3 className="section-label mb-3">Performance Overview</h3>
                    <div className="space-y-5">
                        <div>
                            <p className="text-xs text-muted-text font-body mb-0.5">Issues Reported</p>
                            <p className="font-mono text-3xl font-bold">{totalCount}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text font-body mb-0.5">Resolved</p>
                            <p className="font-mono text-3xl font-bold text-status-resolved">{resolvedCount}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-text font-body mb-0.5">Average Response Time</p>
                            <p className="font-mono text-3xl font-bold">3.2 days</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sector Response Rates */}
            <div className="card p-5 mt-6">
                <h3 className="section-label mb-4">Sector Response Rates</h3>
                <div className="space-y-3">
                    {SECTOR_RATES.map(([sector, rate]) => {
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
                    })}
                </div>
            </div>
        </div>
    );
}
