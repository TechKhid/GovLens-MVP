'use client';

import { useState } from 'react';
import {
    BriefingPost, PostType, Sector, POST_TYPE_COLORS,
    SECTOR_COLORS, SECTORS, formatDate,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useRole } from '@/context/RoleContext';
import SectorTag from '@/components/SectorTag';
import EmptyState from '@/components/EmptyState';

export default function BriefingsPage() {
    const { briefings, addBriefing } = useDataStore();
    const { role } = useRole();
    const [selectedPost, setSelectedPost] = useState<BriefingPost | null>(null);
    const [showCompose, setShowCompose] = useState(false);

    // Compose form state
    const [composeTitle, setComposeTitle] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [composeType, setComposeType] = useState<PostType>('Briefing');
    const [composeSectors, setComposeSectors] = useState<Sector[]>([]);
    const [composePinned, setComposePinned] = useState(false);

    // Sort: pinned first, then by date
    const sortedPosts = [...briefings].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const handlePublish = () => {
        if (!composeTitle.trim() || !composeBody.trim()) return;
        addBriefing({
            type: composeType,
            title: composeTitle.trim(),
            body: composeBody.trim(),
            sectors: composeSectors.length > 0 ? composeSectors : ['Other'],
            date: new Date().toISOString(),
            views: 0,
            pinned: composePinned,
            author: { name: 'MP Office', avatar: 'MP' },
        });
        // Reset form
        setComposeTitle('');
        setComposeBody('');
        setComposeType('Briefing');
        setComposeSectors([]);
        setComposePinned(false);
        setShowCompose(false);
    };

    const toggleSector = (sector: Sector) => {
        setComposeSectors((prev) =>
            prev.includes(sector)
                ? prev.filter((s) => s !== sector)
                : [...prev, sector]
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="font-display text-2xl font-bold">Briefings & Announcements</h1>
                    <p className="text-sm text-muted-text font-body mt-1">
                        Official updates, notices, and responses from the MP office
                    </p>
                </div>
                {role === 'mp' && (
                    <button
                        onClick={() => setShowCompose(!showCompose)}
                        className="btn-primary hidden md:block"
                    >
                        {showCompose ? 'Cancel' : '+ New Briefing'}
                    </button>
                )}
            </div>

            {/* Compose Form (MP only) */}
            {showCompose && role === 'mp' && (
                <div className="card p-5 mb-5 space-y-4">
                    <h3 className="font-display text-base font-semibold">Compose Briefing</h3>

                    {/* Type selector */}
                    <div className="flex gap-2">
                        {(['Briefing', 'Notice', 'Response'] as PostType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => setComposeType(type)}
                                className={`pill text-xs cursor-pointer transition-colors ${composeType === type ? 'text-white' : 'bg-background text-primary-text'
                                    }`}
                                style={composeType === type ? { backgroundColor: POST_TYPE_COLORS[type] } : {}}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Title */}
                    <input
                        type="text"
                        value={composeTitle}
                        onChange={(e) => setComposeTitle(e.target.value)}
                        placeholder="Briefing title..."
                        className="input-field"
                    />

                    {/* Body */}
                    <textarea
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        placeholder="Write your briefing content..."
                        className="textarea-field h-32"
                    />

                    {/* Sector tags */}
                    <div>
                        <p className="section-label mb-2">Sectors</p>
                        <div className="flex flex-wrap gap-2">
                            {SECTORS.map((sector) => (
                                <button
                                    key={sector}
                                    onClick={() => toggleSector(sector)}
                                    className={`pill text-xs cursor-pointer transition-all ${composeSectors.includes(sector)
                                        ? 'text-white'
                                        : 'bg-background text-primary-text'
                                        }`}
                                    style={composeSectors.includes(sector) ? { backgroundColor: SECTOR_COLORS[sector] } : {}}
                                >
                                    {sector}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pin toggle */}
                    <label className="flex items-center gap-2 text-sm font-body cursor-pointer">
                        <input
                            type="checkbox"
                            checked={composePinned}
                            onChange={(e) => setComposePinned(e.target.checked)}
                            className="accent-primary-text"
                        />
                        Pin this briefing to the top
                    </label>

                    {/* Publish */}
                    <button
                        onClick={handlePublish}
                        disabled={!composeTitle.trim() || !composeBody.trim()}
                        className={`btn-primary w-full ${!composeTitle.trim() || !composeBody.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        Publish Briefing
                    </button>
                </div>
            )}

            {sortedPosts.length === 0 ? (
                <EmptyState
                    message="No announcements yet. Check back after the next constituency meeting."
                />
            ) : (
                <div className="flex gap-6">
                    {/* Feed */}
                    <div className="flex-1 min-w-0 space-y-3">
                        {sortedPosts.map((post) => {
                            const typeColor = POST_TYPE_COLORS[post.type];
                            return (
                                <div
                                    key={post.id}
                                    onClick={() => setSelectedPost(post)}
                                    className="card p-4 cursor-pointer hover:shadow-sm transition-shadow"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        {post.pinned && (
                                            <span className="text-xs" title="Pinned">📌</span>
                                        )}
                                        <span
                                            className="pill text-white text-[10px]"
                                            style={{ backgroundColor: typeColor }}
                                        >
                                            {post.type}
                                        </span>
                                    </div>
                                    <h3 className="font-display text-base font-semibold mb-1 leading-tight">
                                        {post.title}
                                    </h3>
                                    <p className="text-sm text-muted-text font-body line-clamp-2 mb-3 leading-relaxed">
                                        {post.body}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {post.sectors.map((sector) => (
                                                <SectorTag key={sector} sector={sector} />
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-text flex-shrink-0">
                                            <span className="font-mono">{formatDate(post.date)}</span>
                                            <span className="flex items-center gap-1">
                                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <circle cx="8" cy="8" r="6" />
                                                    <circle cx="8" cy="8" r="2" />
                                                </svg>
                                                <span className="font-mono">{post.views.toLocaleString()}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            {selectedPost && (
                <>
                    <div className="drawer-overlay animate-fade-in" onClick={() => setSelectedPost(null)} />
                    <div className="drawer-panel animate-slide-in-right w-full max-w-[540px]">
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-border z-10 px-5 py-4">
                            <div className="flex items-center justify-between">
                                <span
                                    className="pill text-white text-[10px]"
                                    style={{ backgroundColor: POST_TYPE_COLORS[selectedPost.type] }}
                                >
                                    {selectedPost.type}
                                </span>
                                <button
                                    onClick={() => setSelectedPost(null)}
                                    className="w-8 h-8 flex items-center justify-center text-muted-text hover:text-primary-text cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Author */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary-text flex items-center justify-center text-white text-sm font-body font-medium">
                                    {selectedPost.author.avatar}
                                </div>
                                <div>
                                    <p className="text-sm font-body font-medium">{selectedPost.author.name}</p>
                                    <p className="text-xs font-mono text-muted-text">{formatDate(selectedPost.date)}</p>
                                </div>
                            </div>

                            {/* Title */}
                            <h2 className="font-display text-xl font-bold leading-tight">
                                {selectedPost.title}
                            </h2>

                            {/* Body */}
                            <div className="text-sm font-body text-primary-text leading-[1.8] whitespace-pre-line">
                                {selectedPost.body}
                            </div>

                            {/* Sector tags */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {selectedPost.sectors.map((sector) => (
                                    <SectorTag key={sector} sector={sector} />
                                ))}
                            </div>

                            {/* Meta */}
                            <div className="flex items-center gap-4 pt-3 border-t border-border text-xs text-muted-text">
                                <span className="flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <circle cx="8" cy="8" r="6" />
                                        <circle cx="8" cy="8" r="2" />
                                    </svg>
                                    <span className="font-mono">{selectedPost.views.toLocaleString()} views</span>
                                </span>
                                {selectedPost.pinned && (
                                    <span>📌 Pinned</span>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Mobile FAB (MP only) */}
            {role === 'mp' && (
                <button
                    onClick={() => setShowCompose(true)}
                    className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary-text text-white rounded-full flex items-center justify-center text-2xl shadow-lg z-20 cursor-pointer"
                >
                    +
                </button>
            )}
        </div>
    );
}
