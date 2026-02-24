'use client';

import { useState } from 'react';
import {
    mockBriefings, BriefingPost, POST_TYPE_COLORS,
    SECTOR_COLORS, formatDate,
} from '@/lib/mockData';
import SectorTag from '@/components/SectorTag';
import EmptyState from '@/components/EmptyState';

export default function BriefingsPage() {
    const [selectedPost, setSelectedPost] = useState<BriefingPost | null>(null);

    // Sort: pinned first, then by date
    const sortedPosts = [...mockBriefings].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
            <div className="mb-5">
                <h1 className="font-display text-2xl font-bold">Briefings & Announcements</h1>
                <p className="text-sm text-muted-text font-body mt-1">
                    Official updates, notices, and responses from the MP office
                </p>
            </div>

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
        </div>
    );
}
