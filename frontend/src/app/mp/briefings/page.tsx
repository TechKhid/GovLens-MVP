'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    PostType, Sector, SECTORS,
    SECTOR_COLORS, POST_TYPE_COLORS, formatDate,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth } from '@/context/RoleContext';
import SectorTag from '@/components/SectorTag';
import { matchesConstituencyZone } from '@/lib/geo-scope';
import {
    buildBriefingDraftFromCluster,
    buildIssueClusters,
} from '@/lib/issueIntelligence';

const POST_TYPES: PostType[] = ['Briefing', 'Notice', 'Response'];

export default function MPBriefingsPage() {
    const { briefings, addBriefing, issues } = useDataStore();
    const { user } = useAuth();
    const [postType, setPostType] = useState<PostType>('Briefing');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<Set<Sector>>(new Set());
    const [isPinned, setIsPinned] = useState(false);
    const [selectedClusterKey, setSelectedClusterKey] = useState('');
    const [aiDraftClusterKey, setAiDraftClusterKey] = useState('');
    const [aiReviewConfirmed, setAiReviewConfirmed] = useState(false);

    const scopedIssues = useMemo(() => {
        if (!user?.constituency) return issues;
        return issues.filter((issue) => matchesConstituencyZone(user.constituency, issue.zone));
    }, [issues, user?.constituency]);

    const issueClusters = useMemo(() => buildIssueClusters(scopedIssues, 2), [scopedIssues]);

    useEffect(() => {
        if (issueClusters.length === 0) {
            setSelectedClusterKey('');
            setAiDraftClusterKey('');
            setAiReviewConfirmed(false);
            return;
        }

        if (!issueClusters.some((cluster) => cluster.key === selectedClusterKey)) {
            setSelectedClusterKey(issueClusters[0].key);
        }

        if (aiDraftClusterKey && !issueClusters.some((cluster) => cluster.key === aiDraftClusterKey)) {
            setAiDraftClusterKey('');
            setAiReviewConfirmed(false);
        }
    }, [aiDraftClusterKey, issueClusters, selectedClusterKey]);

    const selectedCluster = useMemo(
        () => issueClusters.find((cluster) => cluster.key === selectedClusterKey) ?? null,
        [issueClusters, selectedClusterKey]
    );
    const aiDraftCluster = useMemo(
        () => issueClusters.find((cluster) => cluster.key === aiDraftClusterKey) ?? null,
        [aiDraftClusterKey, issueClusters]
    );

    const toggleSector = (sector: Sector) => {
        setSelectedSectors((prev) => {
            const next = new Set(prev);
            if (next.has(sector)) next.delete(sector);
            else next.add(sector);
            return next;
        });
    };

    const canPublish = title.trim() !== '' && body.trim() !== '' && (!aiDraftClusterKey || aiReviewConfirmed);

    const handleGenerateDraft = () => {
        if (!selectedCluster) return;

        const draft = buildBriefingDraftFromCluster(selectedCluster);
        setPostType(draft.type);
        setTitle(draft.title);
        setBody(draft.body);
        setSelectedSectors(new Set(draft.sectors));
        setAiDraftClusterKey(selectedCluster.key);
        setAiReviewConfirmed(false);
    };

    const handlePublish = async () => {
        if (!canPublish) return;
        await addBriefing({
            type: postType,
            title: title.trim(),
            body: body.trim(),
            sectors: selectedSectors.size > 0 ? Array.from(selectedSectors) : ['Other'],
            date: new Date().toISOString(),
            views: 0,
            pinned: isPinned,
            author: { name: 'MP Office', avatar: 'MP' },
        });
        setTitle('');
        setBody('');
        setSelectedSectors(new Set());
        setIsPinned(false);
        setAiDraftClusterKey('');
        setAiReviewConfirmed(false);
    };

    // Stats
    const totalPosts = briefings.length;
    const totalViews = briefings.reduce((sum, briefing) => sum + briefing.views, 0);
    const pinnedCount = briefings.filter((briefing) => briefing.pinned).length;
    const countByType: Record<PostType, number> = {
        Briefing: briefings.filter((briefing) => briefing.type === 'Briefing').length,
        Notice: briefings.filter((briefing) => briefing.type === 'Notice').length,
        Response: briefings.filter((briefing) => briefing.type === 'Response').length,
    };

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold">Briefing Management</h1>
                <p className="text-sm text-muted-text font-body mt-1">
                    Compose and publish announcements to constituents
                </p>
            </div>

            <div className="flex gap-6">
                <div className="flex-1 min-w-0">
                    <div className="card p-5 space-y-5">
                        <div className="rounded border border-blue-200 bg-blue-50 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <p className="section-label text-briefing-blue">AI Drafts From Live Issue Clusters</p>
                                    <p className="text-xs text-muted-text font-body mt-1">
                                        Generate a draft from repeated issue clusters in your constituency. Human review is required before anything can be published.
                                    </p>
                                </div>
                                <span className="pill text-[10px] bg-white text-briefing-blue border border-blue-200">
                                    Review required
                                </span>
                            </div>

                            {issueClusters.length === 0 ? (
                                <p className="text-sm text-muted-text font-body">
                                    No live clusters yet. AI draft suggestions appear once at least two related issues land in the same zone and sector.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <select
                                        value={selectedClusterKey}
                                        onChange={(e) => setSelectedClusterKey(e.target.value)}
                                        className="input-field"
                                    >
                                        {issueClusters.map((cluster) => (
                                            <option key={cluster.key} value={cluster.key}>
                                                {cluster.sector} - {cluster.zone} ({cluster.count} issues)
                                            </option>
                                        ))}
                                    </select>

                                    {selectedCluster && (
                                        <div className="rounded border border-white bg-white p-3 space-y-3">
                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <SectorTag sector={selectedCluster.sector} />
                                                    <span className="text-sm font-body font-medium">
                                                        {selectedCluster.zone}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-mono text-muted-text">
                                                    {selectedCluster.count} linked issues
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="rounded bg-background px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">High priority</p>
                                                    <p className="text-sm font-body font-medium">{selectedCluster.highSeverityCount}</p>
                                                </div>
                                                <div className="rounded bg-background px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Still active</p>
                                                    <p className="text-sm font-body font-medium">{selectedCluster.activeCount}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Sample reports</p>
                                                {selectedCluster.topTitles.map((clusterTitle) => (
                                                    <p
                                                        key={`${selectedCluster.key}-${clusterTitle}`}
                                                        className="text-sm font-body text-primary-text"
                                                    >
                                                        - {clusterTitle}
                                                    </p>
                                                ))}
                                            </div>

                                            <button
                                                onClick={handleGenerateDraft}
                                                className="btn-secondary w-full"
                                            >
                                                Generate Draft
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="section-label block mb-2">Post Type</label>
                            <div className="flex gap-2">
                                {POST_TYPES.map((type) => {
                                    const isActive = postType === type;
                                    const color = POST_TYPE_COLORS[type];
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setPostType(type)}
                                            className={`flex-1 py-2.5 text-sm font-body font-medium border cursor-pointer transition-all ${isActive
                                                ? 'text-white'
                                                : 'bg-white text-primary-text border-border hover:bg-background'
                                                }`}
                                            style={isActive ? { backgroundColor: color, borderColor: color } : {}}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="section-label block mb-1.5">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    if (aiDraftClusterKey) setAiReviewConfirmed(false);
                                }}
                                placeholder="Announcement title"
                                className="input-field"
                            />
                        </div>

                        <div>
                            <label className="section-label block mb-1.5">Body *</label>
                            <textarea
                                value={body}
                                onChange={(e) => {
                                    setBody(e.target.value);
                                    if (aiDraftClusterKey) setAiReviewConfirmed(false);
                                }}
                                placeholder="Write your announcement..."
                                className="textarea-field h-48"
                            />
                        </div>

                        <div>
                            <label className="section-label block mb-2">Related Sectors</label>
                            <div className="flex flex-wrap gap-2">
                                {SECTORS.map((sector) => {
                                    const isSelected = selectedSectors.has(sector);
                                    const color = SECTOR_COLORS[sector];
                                    return (
                                        <button
                                            key={sector}
                                            onClick={() => toggleSector(sector)}
                                            className={`pill cursor-pointer transition-all ${isSelected
                                                ? 'text-white'
                                                : 'bg-background text-primary-text hover:bg-white'
                                                }`}
                                            style={isSelected ? { backgroundColor: color } : {}}
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: isSelected ? 'white' : color }}
                                            />
                                            {sector}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="section-label block mb-1.5">Link Related Issues (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. GL-001, GL-005"
                                className="input-field"
                            />
                            <p className="text-[10px] text-muted-text mt-1 font-body">Visual only in prototype</p>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPinned}
                                onChange={(e) => setIsPinned(e.target.checked)}
                                className="accent-primary-text"
                            />
                            <span className="text-sm font-body">Pin this post</span>
                        </label>

                        {aiDraftCluster && (
                            <div className="rounded border border-amber-200 bg-amber-50 p-4 space-y-3">
                                <div>
                                    <p className="section-label text-amber-700">AI draft review gate</p>
                                    <p className="text-xs text-muted-text font-body mt-1">
                                        This draft came from {aiDraftCluster.count} live issues in {aiDraftCluster.zone}. Review and edit the content before publishing it.
                                    </p>
                                </div>

                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={aiReviewConfirmed}
                                        onChange={(e) => setAiReviewConfirmed(e.target.checked)}
                                        className="mt-0.5 accent-primary-text"
                                    />
                                    <span className="text-sm font-body text-primary-text">
                                        I have reviewed this AI-generated draft and approve it for publication.
                                    </span>
                                </label>

                                {!aiReviewConfirmed && (
                                    <p className="text-[10px] text-muted-text font-body">
                                        Publish stays disabled until this human review is confirmed.
                                    </p>
                                )}

                                <button
                                    onClick={() => {
                                        setAiDraftClusterKey('');
                                        setAiReviewConfirmed(false);
                                    }}
                                    className="text-xs font-body text-amber-700 hover:underline"
                                >
                                    Discard AI draft lock and continue manually
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-2 border-t border-border">
                            <button className="btn-secondary flex-1">Save Draft</button>
                            <button
                                onClick={handlePublish}
                                disabled={!canPublish}
                                className={`btn-primary flex-1 ${!canPublish ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                Publish
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="hidden lg:block w-[280px] flex-shrink-0">
                    <div className="card p-4 space-y-4">
                        <h4 className="section-label">Post Statistics</h4>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-body">Total Posts</span>
                                <span className="font-mono text-sm font-medium">{totalPosts}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-body">Total Views</span>
                                <span className="font-mono text-sm font-medium">{totalViews.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-body">Pinned</span>
                                <span className="font-mono text-sm font-medium">{pinnedCount}</span>
                            </div>

                            <div className="pt-3 border-t border-border">
                                <p className="section-label mb-2">By Type</p>
                                {POST_TYPES.map((type) => (
                                    <div key={type} className="flex items-center justify-between py-1">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: POST_TYPE_COLORS[type] }}
                                            />
                                            <span className="text-xs font-body">{type}</span>
                                        </div>
                                        <span className="font-mono text-xs text-muted-text">{countByType[type]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="card mt-4">
                        <div className="px-4 py-3 border-b border-border">
                            <h4 className="section-label">Recent Posts</h4>
                        </div>
                        <div className="divide-y divide-border">
                            {briefings.slice(0, 3).map((post) => (
                                <div key={post.id} className="px-4 py-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: POST_TYPE_COLORS[post.type] }}
                                        />
                                        <span className="text-[10px] font-body text-muted-text">{post.type}</span>
                                    </div>
                                    <p className="text-xs font-body font-medium line-clamp-1">{post.title}</p>
                                    <p className="text-[10px] font-mono text-muted-text mt-0.5">{formatDate(post.date)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
