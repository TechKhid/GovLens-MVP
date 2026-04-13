'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

import { useDataStore } from '@/context/DataStoreContext';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { matchesConstituencyZone } from '@/lib/geo-scope';
import { SECTOR_COLORS, Sector } from '@/lib/mockData';

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

interface SentimentData {
    average_compound: number;
    severity_distribution: { low: number; medium: number; high: number };
    overall_severity: string;
    sample_size: number;
}

const APPROVAL_SEGMENT_STYLES = {
    low: {
        bar: 'bg-status-resolved',
        text: 'text-status-resolved',
    },
    medium: {
        bar: 'bg-primary-text',
        text: 'text-primary-text',
    },
    high: {
        bar: 'bg-status-critical',
        text: 'text-status-critical',
    },
} as const;

function compoundToApproval(compound: number): number {
    return Math.round(Math.max(0, Math.min(100, (compound + 1) * 50)));
}

export default function MPProfilePage() {
    const { issues } = useDataStore();
    const [mpProfile, setMpProfile] = useState<MPPublicProfileResponse | null>(null);
    const [sentiment, setSentiment] = useState<SentimentData | null>(null);
    const [mlUnavailable, setMlUnavailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const user = getCurrentUser();
                const constituency = user?.constituency || 'Ayawaso West Wuogon';

                const profile = await api.get<MPPublicProfileResponse>(
                    `/mp/public-profile?constituency=${encodeURIComponent(constituency)}`
                );
                setMpProfile(profile);

                const sentimentResult = await api
                    .get<SentimentData>(`/ml/sentiment?zone=${encodeURIComponent(constituency)}`)
                    .then((value) => ({ ok: true as const, value }))
                    .catch(() => ({ ok: false as const }));

                if (sentimentResult.ok) {
                    setSentiment(sentimentResult.value);
                    setMlUnavailable(false);
                } else {
                    setSentiment(null);
                    setMlUnavailable(true);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load profile');
                setMpProfile(null);
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
                <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center text-2xl font-semibold mb-4">
                    MP
                </div>
                <h2 className="font-display text-2xl font-bold mb-2">No MP Registered</h2>
                <p className="text-muted-text font-body max-w-md">
                    There is currently no Member of Parliament registered for your constituency.
                    Encourage your local representative to join GovLens to connect with constituents.
                </p>
            </div>
        );
    }

    const mp = mpProfile;
    const initials = mp.name
        .split(' ')
        .slice(-2)
        .map((name) => name[0])
        .join('')
        .toUpperCase();

    const constituencyIssues = issues.filter((issue) =>
        matchesConstituencyZone(mp.constituency, issue.zone)
    );
    const totalCount = constituencyIssues.length;
    const resolvedCount = constituencyIssues.filter((issue) => issue.status === 'Resolved').length;
    const approvalRating = sentiment ? compoundToApproval(sentiment.average_compound) : null;
    const severitySegments = sentiment
        ? [
              {
                  key: 'low' as const,
                  label: 'routine',
                  count: sentiment.severity_distribution.low,
              },
              {
                  key: 'medium' as const,
                  label: 'medium',
                  count: sentiment.severity_distribution.medium,
              },
              {
                  key: 'high' as const,
                  label: 'urgent',
                  count: sentiment.severity_distribution.high,
              },
          ]
        : [];

    const sectorRates: [Sector, number][] = (() => {
        const sectorCounts = new Map<Sector, number>();
        for (const issue of constituencyIssues) {
            const sector = issue.sector as Sector;
            sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
        }

        return Array.from(sectorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7)
            .map(([sector, count]) => [
                sector,
                totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
            ]);
    })();

    return (
        <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6">
            {error && (
                <div className="mb-4 px-3 py-2 bg-yellow-50 border border-yellow-200 text-xs text-yellow-800 font-body">
                    Note: showing cached data - {error}
                </div>
            )}

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
                            {mp.constituency} {mp.party && ` - ${mp.party}`}
                        </p>
                        {mp.term_start && mp.term_end && (
                            <p className="text-xs font-mono text-muted-text mt-0.5">
                                {mp.term_start} - {mp.term_end}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {mp.bio && (
                <div className="card p-6 mb-6">
                    <h3 className="section-label mb-3">Biography</h3>
                    <p className="font-body text-sm text-primary-text leading-relaxed">
                        {mp.bio}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-5">
                    <h3 className="section-label mb-3">Approval Rating</h3>
                    {approvalRating === null ? (
                        <div className="h-24 flex items-center">
                            <p className="text-xs text-muted-text font-body">
                                {mlUnavailable
                                    ? 'ML sentiment unavailable right now.'
                                    : 'Derived from citizen sentiment - loading...'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-end gap-3 mb-2">
                                <span className="font-mono text-5xl font-bold text-primary-text">
                                    {approvalRating}%
                                </span>
                            </div>
                            {sentiment && (
                                <div className="mt-3">
                                    <p className="text-[10px] text-muted-text font-body mb-1">
                                        Based on {sentiment.sample_size} issue reports
                                    </p>
                                    <div className="flex h-2 rounded-full overflow-hidden bg-background">
                                        {severitySegments.map((segment) => (
                                            <div
                                                key={segment.key}
                                                className={`${APPROVAL_SEGMENT_STYLES[segment.key].bar} flex-none`}
                                                style={{
                                                    width: `${(segment.count / Math.max(sentiment.sample_size, 1)) * 100}%`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-3 mt-1">
                                        {severitySegments.map((segment) => (
                                            <span
                                                key={segment.key}
                                                className={`text-[9px] font-mono ${APPROVAL_SEGMENT_STYLES[segment.key].text}`}
                                            >
                                                {segment.count} {segment.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

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

            <div className="card p-5 mt-6">
                <h3 className="section-label mb-4">Sector Issue Distribution</h3>
                {sectorRates.length === 0 ? (
                    <p className="text-xs text-muted-text font-body">
                        No sector data yet - submit some issues to see distribution.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {sectorRates.map(([sector, rate]) => {
                            const color = SECTOR_COLORS[sector] ?? '#888';
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
                )}
            </div>
        </div>
    );
}
