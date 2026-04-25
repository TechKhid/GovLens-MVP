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
import { api, resolveApiUrl } from '@/lib/api';
import { useAuth } from '@/context/RoleContext';
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
    assignee?: string | null;
    internal_notes?: string | null;
    zone?: string | null;
    lat?: number | null;
    lng?: number | null;
    upvotes?: number | null;
    image_urls?: string[] | null;
    created_at: string;
    updated_at: string;
    // present when fetched with upvote check
    has_upvoted?: boolean;
}

interface ApiIssueWithUpvote extends ApiIssue {
    has_upvoted: boolean;
}

interface ApiComment {
    id: string;
    issue_id: string;
    user_id: string;
    content: string;
    created_at: string;
    user_name: string;
    user_role?: string;
}

interface ApiBriefing {
    id: string;
    mp_id: string;
    title: string;
    content: string;
    zone?: string | null;
    post_type?: string | null;
    sectors?: string[] | null;
    pinned?: boolean | null;
    views?: number | null;
    published_at?: string | null;
    created_at: string;
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
        healthcare: 'Other',
        environment: 'Other',
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
        reporterId: a.user_id,
        photos: (a.image_urls ?? []).map(resolveApiUrl),
        location: {
            address: a.zone ?? '',
            gps: { lat: a.lat ?? 0, lng: a.lng ?? 0 },
        },
        submittedAt: a.created_at,
        upvotes: a.upvotes ?? 0,
        comments: [],
        affectedResidents: 0,
        assignedTo: a.assignee ?? undefined,
        internalNotes: a.internal_notes ?? undefined,
        timeline: [{ status: mapStatus(a.status), date: a.created_at }],
    };
}

function mapStatus(s: string): Issue['status'] {
    const map: Record<string, Issue['status']> = {
        open: 'Reported',
        acknowledged: 'Acknowledged',
        'in-progress': 'In Progress',
        escalated: 'In Progress',
        'pending-verification': 'Pending Verification',
        'verified-resolved': 'Verified Resolved',
        resolved: 'Verified Resolved',
        reopened: 'Reopened',
    };
    return map[s] ?? 'Reported';
}

function toApiStatus(status: Issue['status']): string {
    const map: Record<Issue['status'], string> = {
        'Reported': 'open',
        'Acknowledged': 'acknowledged',
        'In Progress': 'in-progress',
        'Pending Verification': 'pending-verification',
        'Verified Resolved': 'verified-resolved',
        'Reopened': 'reopened',
    };
    return map[status];
}

function mapApiComment(comment: ApiComment): Comment {
    const normalizedRole = comment.user_role?.toLowerCase();
    const isMPOffice = normalizedRole === 'mp' || normalizedRole === 'admin' || normalizedRole === 'sysadmin'
        || comment.user_name.toLowerCase().includes('mp')
        || comment.user_name.toLowerCase().includes('hon.');
    return {
        id: comment.id,
        author: isMPOffice ? 'MP Office' : comment.user_name,
        avatar: isMPOffice ? 'MP' : comment.user_name.slice(0, 2).toUpperCase(),
        content: comment.content,
        timestamp: comment.created_at,
        likes: 0,
        isMPOffice,
    };
}

function normalizePostType(postType?: string | null): BriefingPost['type'] {
    const normalized = postType?.trim().toLowerCase();
    if (normalized === 'notice') return 'Notice';
    if (normalized === 'response') return 'Response';
    return 'Briefing';
}

function mapApiBriefing(briefing: ApiBriefing): BriefingPost {
    const sectors: BriefingPost['sectors'] = briefing.sectors?.length
        ? briefing.sectors.map(normalizeSector)
        : ['Other'];

    return {
        id: briefing.id,
        type: normalizePostType(briefing.post_type),
        title: briefing.title,
        body: briefing.content,
        sectors,
        date: briefing.published_at ?? briefing.created_at,
        views: briefing.views ?? 0,
        pinned: briefing.pinned ?? false,
        author: { name: 'MP Office', avatar: 'MP' },
    };
}

// ── Context shape ──────────────────────────────────────────────────────────

interface DataStoreContextType {
    issues: Issue[];
    briefings: BriefingPost[];
    zones: ZoneData[];
    upvotedIds: Set<string>;
    loading: boolean;

    addIssue: (issue: Omit<Issue, 'id'> & { lat?: number; lng?: number; photoFiles?: File[] }) => Promise<string>;
    updateIssue: (id: string, patch: Partial<Issue>) => void;
    addComment: (issueId: string, comment: Omit<Comment, 'id'>) => Promise<void>;
    loadComments: (issueId: string) => Promise<void>;
    changeIssueStatus: (issueId: string, status: Issue['status'], note?: string) => Promise<void>;
    saveIssueManagement: (issueId: string, updates: Pick<Issue, 'severity' | 'assignedTo' | 'internalNotes'>) => Promise<void>;
    verifyIssue: (issueId: string, action: 'confirm' | 'dispute', comment?: string) => Promise<void>;
    toggleUpvote: (id: string) => Promise<void>;
    isUpvoted: (id: string) => boolean;
    refreshIssues: () => Promise<void>;

    addBriefing: (post: Omit<BriefingPost, 'id'>) => Promise<string>;
    nextIssueId: () => string;
}

const DataStoreContext = createContext<DataStoreContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export function DataStoreProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [briefings, setBriefings] = useState<BriefingPost[]>([]);
    const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

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

    const refreshBriefings = useCallback(async () => {
        try {
            const data = await api.get<ApiBriefing[]>('/briefings');
            setBriefings(data.map(mapApiBriefing));
        } catch (err) {
            console.error('Failed to fetch briefings:', err);
        }
    }, []);

    useEffect(() => {
        void refreshIssues();
        void refreshBriefings();
    }, [refreshBriefings, refreshIssues, user?.sub]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleFocus = () => {
            void refreshIssues();
            void refreshBriefings();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refreshIssues();
                void refreshBriefings();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshBriefings, refreshIssues]);

    // ── Issue actions ──────────────────────────────────────────────────────

    const addIssue = useCallback(
        async (issueData: Omit<Issue, 'id'> & { lat?: number; lng?: number; photoFiles?: File[] }): Promise<string> => {
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
                const created = issueData.photoFiles && issueData.photoFiles.length > 0
                    ? await (() => {
                        const formData = new FormData();
                        formData.append('title', body.title);
                        formData.append('description', body.description);
                        formData.append('sector', body.sector);
                        formData.append('severity', body.severity);
                        formData.append('zone', body.zone);
                        formData.append('lat', String(body.lat));
                        formData.append('lng', String(body.lng));
                        for (const file of issueData.photoFiles ?? []) {
                            formData.append('images', file);
                        }
                        return api.postForm<ApiIssue>('/issues', formData);
                    })()
                    : await api.post<ApiIssue>('/issues', body);
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

    const appendLocalComment = useCallback((issueId: string, commentData: Omit<Comment, 'id'>) => {
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

    const loadComments = useCallback(async (issueId: string) => {
        try {
            const comments = await api.get<ApiComment[]>(`/issues/${issueId}/comments`);
            setIssues((prev) =>
                prev.map((issue) =>
                    issue.id === issueId
                        ? { ...issue, comments: comments.map(mapApiComment) }
                        : issue
                )
            );
        } catch (err) {
            console.error('Failed to load comments:', err);
        }
    }, []);

    const addComment = useCallback(async (issueId: string, commentData: Omit<Comment, 'id'>) => {
        const content = commentData.content.trim();
        if (!content) {
            throw new Error('Comment content is required.');
        }

        await api.post(`/issues/${issueId}/comments`, { content });
        appendLocalComment(issueId, commentData);
        await loadComments(issueId);
    }, [appendLocalComment, loadComments]);

    const applyStatusLocally = useCallback((issueId: string, status: Issue['status'], note?: string) => {
        setIssues((prev) =>
            prev.map((issue) => {
                if (issue.id !== issueId) return issue;
                const timeline = [
                    ...issue.timeline,
                    {
                        status,
                        date: new Date().toISOString(),
                        ...(note ? { note } : {}),
                    },
                ];
                return { ...issue, status, timeline };
            })
        );
    }, []);

    const changeIssueStatus = useCallback(async (issueId: string, status: Issue['status'], note?: string) => {
        await api.patch(`/issues/${issueId}/status`, {
            status: toApiStatus(status),
            note: note?.trim() || undefined,
        });
        applyStatusLocally(issueId, status, note);
        if (note?.trim()) {
            appendLocalComment(issueId, {
                author: user?.role === 'mp' ? 'MP Office' : user?.name || 'You',
                avatar: user?.role === 'mp' ? 'MP' : 'YO',
                content: note.trim(),
                timestamp: new Date().toISOString(),
                likes: 0,
                isMPOffice: user?.role === 'mp',
            });
        }
    }, [appendLocalComment, applyStatusLocally, user?.name, user?.role]);

    const saveIssueManagement = useCallback(async (
        issueId: string,
        updates: Pick<Issue, 'severity' | 'assignedTo' | 'internalNotes'>
    ) => {
        const updated = await api.patch<ApiIssue>(`/issues/${issueId}/manage`, {
            severity: updates.severity,
            assignee: updates.assignedTo ?? '',
            internal_note: updates.internalNotes ?? '',
        });

        setIssues((prev) =>
            prev.map((issue) =>
                issue.id === issueId
                    ? {
                        ...issue,
                        severity: normalizeSeverity(updated.severity),
                        assignedTo: updated.assignee ?? undefined,
                        internalNotes: updated.internal_notes ?? undefined,
                    }
                    : issue
            )
        );
    }, []);

    const verifyIssue = useCallback(async (issueId: string, action: 'confirm' | 'dispute', comment?: string) => {
        await api.post(`/issues/${issueId}/verify`, {
            action,
            comment: comment?.trim() || undefined,
        });
        const nextStatus: Issue['status'] = action === 'confirm' ? 'Verified Resolved' : 'Reopened';
        applyStatusLocally(issueId, nextStatus, comment);
        if (action === 'dispute' || comment?.trim()) {
            appendLocalComment(issueId, {
                author: user?.name || 'You',
                avatar: 'YO',
                content: comment?.trim() || 'Reporter disputed the claimed resolution.',
                timestamp: new Date().toISOString(),
                likes: 0,
                isMPOffice: false,
            });
        }
    }, [appendLocalComment, applyStatusLocally, user?.name]);

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

    const addBriefing = useCallback(async (postData: Omit<BriefingPost, 'id'>): Promise<string> => {
        const created = await api.post<ApiBriefing>('/briefings', {
            title: postData.title,
            content: postData.body,
            zone: '',
            post_type: postData.type,
            sectors: postData.sectors,
            pinned: postData.pinned,
        });
        const mapped = mapApiBriefing(created);
        setBriefings((prev) => [mapped, ...prev]);
        return created.id;
    }, []);

    const nextIssueId = useCallback(() => `GL-new-${Date.now()}`, []);

    // ── Zones derived from real issues (grouped by zone name) ──────────────

    const zones = useMemo<ZoneData[]>(() => {
        const acc: Record<string, { issueCount: number; resolvedCount: number }> = {};
        issues.forEach((issue) => {
            if (!issue.zone) return;
            if (!acc[issue.zone]) acc[issue.zone] = { issueCount: 0, resolvedCount: 0 };
            acc[issue.zone].issueCount += 1;
            if (issue.status === 'Verified Resolved') acc[issue.zone].resolvedCount += 1;
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
            loadComments,
            changeIssueStatus,
            saveIssueManagement,
            verifyIssue,
            toggleUpvote,
            isUpvoted,
            refreshIssues,
            addBriefing,
            nextIssueId,
        }),
        [
            issues, briefings, zones, upvotedIds, loading,
            addIssue, updateIssue, addComment, loadComments, changeIssueStatus,
            saveIssueManagement, verifyIssue, toggleUpvote, isUpvoted, refreshIssues,
            addBriefing, nextIssueId,
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
