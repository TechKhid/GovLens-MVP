'use client';

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    Issue, Comment, BriefingPost, Sector, Status, Severity,
    mockIssues, mockBriefings, mockZones, ZoneData, ZONES,
} from '@/lib/mockData';

// ── Context shape ──────────────────────────────────────────────

interface DataStoreContextType {
    // Data
    issues: Issue[];
    briefings: BriefingPost[];
    zones: ZoneData[];
    upvotedIds: Set<string>;

    // Issue actions
    addIssue: (issue: Omit<Issue, 'id'>) => string;
    updateIssue: (id: string, patch: Partial<Issue>) => void;
    addComment: (issueId: string, comment: Omit<Comment, 'id'>) => void;
    toggleUpvote: (id: string) => void;
    isUpvoted: (id: string) => boolean;

    // Briefing actions
    addBriefing: (post: Omit<BriefingPost, 'id'>) => string;

    // ID generation
    nextIssueId: () => string;
    nextBriefingId: () => string;
}

const DataStoreContext = createContext<DataStoreContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────

export function DataStoreProvider({ children }: { children: ReactNode }) {
    const [issues, setIssues] = useState<Issue[]>(() => [...mockIssues]);
    const [briefings, setBriefings] = useState<BriefingPost[]>(() => [...mockBriefings]);
    const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
    const [issueCounter, setIssueCounter] = useState(mockIssues.length);
    const [briefingCounter, setBriefingCounter] = useState(mockBriefings.length);

    // --- ID generators ---

    const nextIssueId = useCallback(() => {
        let id = '';
        setIssueCounter((c) => {
            const next = c + 1;
            id = `GL-${String(next).padStart(3, '0')}`;
            return next;
        });
        return id;
    }, []);

    const nextBriefingId = useCallback(() => {
        let id = '';
        setBriefingCounter((c) => {
            const next = c + 1;
            id = `B-${String(next).padStart(3, '0')}`;
            return next;
        });
        return id;
    }, []);

    // --- Issue actions ---

    const addIssue = useCallback((issueData: Omit<Issue, 'id'>): string => {
        let id = '';
        setIssueCounter((c) => {
            const next = c + 1;
            id = `GL-${String(next).padStart(3, '0')}`;
            return next;
        });
        // Use a ref-stable setter so we don't depend on issueCounter
        setIssues((prev) => [{ ...issueData, id: id || `GL-${String(prev.length + 1).padStart(3, '0')}` }, ...prev]);
        return id;
    }, []);

    const updateIssue = useCallback((id: string, patch: Partial<Issue>) => {
        setIssues((prev) =>
            prev.map((issue) =>
                issue.id === id ? { ...issue, ...patch } : issue
            )
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

    // --- Upvote ---

    const toggleUpvote = useCallback((id: string) => {
        setUpvotedIds((prev) => {
            const next = new Set(prev);
            const wasUpvoted = next.has(id);
            if (wasUpvoted) next.delete(id);
            else next.add(id);

            // Also update the issue's upvotes count
            setIssues((prevIssues) =>
                prevIssues.map((issue) =>
                    issue.id === id
                        ? { ...issue, upvotes: issue.upvotes + (wasUpvoted ? -1 : 1) }
                        : issue
                )
            );

            return next;
        });
    }, []);

    const isUpvoted = useCallback((id: string) => upvotedIds.has(id), [upvotedIds]);

    // --- Briefing actions ---

    const addBriefing = useCallback((postData: Omit<BriefingPost, 'id'>): string => {
        let id = '';
        setBriefingCounter((c) => {
            const next = c + 1;
            id = `B-${String(next).padStart(3, '0')}`;
            return next;
        });
        setBriefings((prev) => [{ ...postData, id: id || `B-${String(prev.length + 1).padStart(3, '0')}` }, ...prev]);
        return id;
    }, []);

    // --- Memoized value ---

    const value = useMemo<DataStoreContextType>(() => ({
        issues,
        briefings,
        zones: mockZones,
        upvotedIds,
        addIssue,
        updateIssue,
        addComment,
        toggleUpvote,
        isUpvoted,
        addBriefing,
        nextIssueId,
        nextBriefingId,
    }), [issues, briefings, upvotedIds, addIssue, updateIssue, addComment, toggleUpvote, isUpvoted, addBriefing, nextIssueId, nextBriefingId]);

    return (
        <DataStoreContext.Provider value={value}>
            {children}
        </DataStoreContext.Provider>
    );
}

// ── Hook ───────────────────────────────────────────────────────

export function useDataStore() {
    const context = useContext(DataStoreContext);
    if (!context) {
        throw new Error('useDataStore must be used within a DataStoreProvider');
    }
    return context;
}
