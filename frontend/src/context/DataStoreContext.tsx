'use client';

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useEffect,
    ReactNode,
} from 'react';
import { api } from '@/lib/api';
import {
    Issue, Comment, BriefingPost, ZoneData,
} from '@/lib/mockData';

// ── API response types (snake_case from Go backend) ────────────────────────

interface ApiIssue {
    id: string;
    user_id: string;
    title: string;
    description: string;
    status: string;
    sector?: string | null;
    severity?: string | null;
    zone?: string | null;
    lat?: number | null;
    lng?: number | null;
    upvotes?: number | null;
    created_at: string;
    updated_at: string;
    // present when fetched with upvote check
    has_upvoted?: boolean;
}

interface ApiIssueWithUpvote extends ApiIssue {
    has_upvoted: boolean;
}

function titleCase(value: string): string {
    return value
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function normalizeSector(sector?: string | null): Issue['sector'] {
    if (!sector) return 'Other';

    const normalized = sector.trim().toLowerCase();
    const map: Record<string, Issue['sector']> = {
        infrastructure: 'Infrastructure',
        sanitation: 'Sanitation',
        roads: 'Roads',
        drainage: 'Drainage',
        education: 'Education',
        water: 'Water',
        security: 'Security',
        other: 'Other',
        unclassified: 'Other',
    };

    return map[normalized] ?? (titleCase(normalized) as Issue['sector']);
}

function normalizeSeverity(severity?: string | null): Issue['severity'] {
    if (!severity) return 'Medium';

    const normalized = severity.trim().toLowerCase();
    const map: Record<string, Issue['severity']> = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical',
    };

    return map[normalized] ?? 'Medium';
}

// Map an API issue to the local Issue shape used by all components.
function mapApiIssue(a: ApiIssue): Issue {
    return {
        id: a.id,
        title: a.title,
        description: a.description,
        sector: normalizeSector(a.sector),
        zone: a.zone ?? '',
        status: mapStatus(a.status),
        severity: normalizeSeverity(a.severity),
        reporter: { name: 'Citizen', avatar: '' },
        photos: [],
        location: {
            address: a.zone ?? '',
            gps: { lat: a.lat ?? 0, lng: a.lng ?? 0 },
        },
        submittedAt: a.created_at,
        upvotes: a.upvotes ?? 0,
        comments: [],
        affectedResidents: 0,
        timeline: [{ status: mapStatus(a.status), date: a.created_at }],
    };
}

function mapStatus(s: string): Issue['status'] {
    const map: Record<string, Issue['status']> = {
        open: 'Reported',
        'in-progress': 'In Progress',
        resolved: 'Resolved',
        acknowledged: 'Acknowledged',
        escalated: 'Escalated',
    };
    return map[s] ?? 'Reported';
}

// ── Context shape ──────────────────────────────────────────────────────────

interface DataStoreContextType {
    issues: Issue[];
    briefings: BriefingPost[];
    zones: ZoneData[];
    upvotedIds: Set<string>;
    loading: boolean;

    addIssue: (issue: Omit<Issue, 'id'> & { lat?: number; lng?: number }) => Promise<string>;
    updateIssue: (id: string, patch: Partial<Issue>) => void;
    addComment: (issueId: string, comment: Omit<Comment, 'id'>) => void;
    toggleUpvote: (id: string) => Promise<void>;
    isUpvoted: (id: string) => boolean;
    refreshIssues: () => Promise<void>;

    addBriefing: (post: Omit<BriefingPost, 'id'>) => string;
    nextIssueId: () => string;
    nextBriefingId: () => string;
}

const DataStoreContext = createContext<DataStoreContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export function DataStoreProvider({ children }: { children: ReactNode }) {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [briefings, setBriefings] = useState<BriefingPost[]>([]);
    const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [briefingCounter, setBriefingCounter] = useState(0);

    // ── Fetch issues from the API ──────────────────────────────────────────

    const refreshIssues = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<ApiIssue[] | ApiIssueWithUpvote[]>('/issues');
            const mapped = data.map(mapApiIssue);
            setIssues(mapped);

            // Populate initial upvotedIds from the has_upvoted field (authed fetch)
            const upvoted = new Set<string>();
            data.forEach((d) => {
                if ('has_upvoted' in d && (d as ApiIssueWithUpvote).has_upvoted) {
                    upvoted.add(d.id);
                }
            });
            setUpvotedIds(upvoted);
        } catch (err) {
            console.error('Failed to fetch issues:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshIssues();
    }, [refreshIssues]);

    // ── Issue actions ──────────────────────────────────────────────────────

    const addIssue = useCallback(
        async (issueData: Omit<Issue, 'id'> & { lat?: number; lng?: number }): Promise<string> => {
            const body = {
                title: issueData.title,
                description: issueData.description,
                zone: issueData.zone ?? '',
                sector: issueData.sector,
                severity: issueData.severity,
                lat: issueData.lat ?? issueData.location?.gps?.lat ?? 0,
                lng: issueData.lng ?? issueData.location?.gps?.lng ?? 0,
            };
            try {
                const created = await api.post<ApiIssue>('/issues', body);
                const mapped = mapApiIssue(created);
                setIssues((prev) => [mapped, ...prev]);
                return created.id;
            } catch (err) {
                console.error('Failed to create issue:', err);
                throw err;
            }
        },
        []
    );

    const updateIssue = useCallback((id: string, patch: Partial<Issue>) => {
        setIssues((prev) =>
            prev.map((issue) => (issue.id === id ? { ...issue, ...patch } : issue))
        );
    }, []);

    const addComment = useCallback((issueId: string, commentData: Omit<Comment, 'id'>) => {
        const commentId = `C-${Date.now()}`;
        const newComment: Comment = { ...commentData, id: commentId };
        setIssues((prev) =>
            prev.map((issue) =>
                issue.id === issueId
                    ? { ...issue, comments: [...issue.comments, newComment] }
                    : issue
            )
        );
    }, []);

    // ── Upvote — optimistic UI + API call ─────────────────────────────────

    const toggleUpvote = useCallback(async (id: string) => {
        // Optimistic update
        setUpvotedIds((prev) => {
            const next = new Set(prev);
            const wasUpvoted = next.has(id);
            if (wasUpvoted) next.delete(id);
            else next.add(id);

            setIssues((prevIssues) =>
                prevIssues.map((issue) =>
                    issue.id === id
                        ? { ...issue, upvotes: issue.upvotes + (wasUpvoted ? -1 : 1) }
                        : issue
                )
            );
            return next;
        });

        // Persist to backend
        try {
            await api.post(`/issues/${id}/upvote`);
        } catch (err) {
            console.error('Upvote failed:', err);
            // Revert on failure
            setUpvotedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setIssues((prevIssues) =>
                    prevIssues.map((issue) =>
                        issue.id === id
                            ? { ...issue, upvotes: issue.upvotes + (next.has(id) ? 1 : -1) }
                            : issue
                    )
                );
                return next;
            });
        }
    }, []);

    const isUpvoted = useCallback((id: string) => upvotedIds.has(id), [upvotedIds]);

    // ── Briefing actions (still local until backend supports them) ──────────

    const addBriefing = useCallback((postData: Omit<BriefingPost, 'id'>): string => {
        let id = '';
        setBriefingCounter((c) => {
            const next = c + 1;
            id = `B-${String(next).padStart(3, '0')}`;
            return next;
        });
        setBriefings((prev) => [
            { ...postData, id: id || `B-${String(prev.length + 1).padStart(3, '0')}` },
            ...prev,
        ]);
        return id;
    }, []);

    const nextIssueId = useCallback(() => `GL-new-${Date.now()}`, []);
    const nextBriefingId = useCallback(() => {
        let id = '';
        setBriefingCounter((c) => {
            const next = c + 1;
            id = `B-${String(next).padStart(3, '0')}`;
            return next;
        });
        return id;
    }, []);

    // ── Zones derived from real issues (grouped by zone name) ──────────────

    const zones = useMemo<ZoneData[]>(() => {
        const acc: Record<string, { issueCount: number; resolvedCount: number }> = {};
        issues.forEach((issue) => {
            if (!issue.zone) return;
            if (!acc[issue.zone]) acc[issue.zone] = { issueCount: 0, resolvedCount: 0 };
            acc[issue.zone].issueCount += 1;
            if (issue.status === 'Resolved') acc[issue.zone].resolvedCount += 1;
        });
        return Object.entries(acc).map(([name, counts]) => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            issueCount: counts.issueCount,
            resolvedCount: counts.resolvedCount,
            x: 0, y: 0, radius: 0, // legacy canvas props, unused
        }));
    }, [issues]);

    // ── Memoized context value ─────────────────────────────────────────────

    const value = useMemo<DataStoreContextType>(
        () => ({
            issues,
            briefings,
            zones,
            upvotedIds,
            loading,
            addIssue,
            updateIssue,
            addComment,
            toggleUpvote,
            isUpvoted,
            refreshIssues,
            addBriefing,
            nextIssueId,
            nextBriefingId,
        }),
        [
            issues, briefings, zones, upvotedIds, loading,
            addIssue, updateIssue, addComment, toggleUpvote,
            isUpvoted, refreshIssues, addBriefing, nextIssueId, nextBriefingId,
        ]
    );

    return (
        <DataStoreContext.Provider value={value}>
            {children}
        </DataStoreContext.Provider>
    );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDataStore() {
    const context = useContext(DataStoreContext);
    if (!context) {
        throw new Error('useDataStore must be used within a DataStoreProvider');
    }
    return context;
}
