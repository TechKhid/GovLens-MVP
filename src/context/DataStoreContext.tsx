'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
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
        const next = issueCounter + 1;
        setIssueCounter(next);
        return `GL-${String(next).padStart(3, '0')}`;
    }, [issueCounter]);

    const nextBriefingId = useCallback(() => {
        const next = briefingCounter + 1;
        setBriefingCounter(next);
        return `B-${String(next).padStart(3, '0')}`;
    }, [briefingCounter]);

    // --- Issue actions ---

    const addIssue = useCallback((issueData: Omit<Issue, 'id'>): string => {
        const id = `GL-${String(issueCounter + 1).padStart(3, '0')}`;
        setIssueCounter((c) => c + 1);
        const newIssue: Issue = { ...issueData, id };
        setIssues((prev) => [newIssue, ...prev]);
        return id;
    }, [issueCounter]);

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
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const isUpvoted = useCallback((id: string) => upvotedIds.has(id), [upvotedIds]);

    // --- Briefing actions ---

    const addBriefing = useCallback((postData: Omit<BriefingPost, 'id'>): string => {
        const id = `B-${String(briefingCounter + 1).padStart(3, '0')}`;
        setBriefingCounter((c) => c + 1);
        const newPost: BriefingPost = { ...postData, id };
        setBriefings((prev) => [newPost, ...prev]);
        return id;
    }, [briefingCounter]);

    return (
        <DataStoreContext.Provider
            value={{
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
            }}
        >
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
