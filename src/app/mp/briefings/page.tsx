'use client';

import { useState } from 'react';
import {
    mockBriefings, PostType, Sector, SECTORS,
    SECTOR_COLORS, POST_TYPE_COLORS, formatDate,
} from '@/lib/mockData';
import SectorTag from '@/components/SectorTag';

const POST_TYPES: PostType[] = ['Briefing', 'Notice', 'Response'];

export default function MPBriefingsPage() {
    const [postType, setPostType] = useState<PostType>('Briefing');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<Set<Sector>>(new Set());
    const [isPinned, setIsPinned] = useState(false);

    const toggleSector = (sector: Sector) => {
        setSelectedSectors((prev) => {
            const next = new Set(prev);
            if (next.has(sector)) next.delete(sector);
            else next.add(sector);
            return next;
        });
    };

    const canPublish = title.trim() !== '' && body.trim() !== '';

    // Stats
    const totalPosts = mockBriefings.length;
    const totalViews = mockBriefings.reduce((sum, b) => sum + b.views, 0);
    const pinnedCount = mockBriefings.filter((b) => b.pinned).length;
    const countByType: Record<PostType, number> = {
        Briefing: mockBriefings.filter((b) => b.type === 'Briefing').length,
        Notice: mockBriefings.filter((b) => b.type === 'Notice').length,
        Response: mockBriefings.filter((b) => b.type === 'Response').length,
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
                {/* Compose Form */}
                <div className="flex-1 min-w-0">
                    <div className="card p-5 space-y-5">
                        {/* Post type selector */}
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

                        {/* Title */}
                        <div>
                            <label className="section-label block mb-1.5">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Announcement title"
                                className="input-field"
                            />
                        </div>

                        {/* Body */}
                        <div>
                            <label className="section-label block mb-1.5">Body *</label>
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Write your announcement..."
                                className="textarea-field h-48"
                            />
                        </div>

                        {/* Sector tags */}
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

                        {/* Related issues */}
                        <div>
                            <label className="section-label block mb-1.5">Link Related Issues (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. GL-001, GL-005"
                                className="input-field"
                            />
                            <p className="text-[10px] text-muted-text mt-1 font-body">Visual only in prototype</p>
                        </div>

                        {/* Pin toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPinned}
                                onChange={(e) => setIsPinned(e.target.checked)}
                                className="accent-primary-text"
                            />
                            <span className="text-sm font-body">📌 Pin this post</span>
                        </label>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2 border-t border-border">
                            <button className="btn-secondary flex-1">Save Draft</button>
                            <button
                                disabled={!canPublish}
                                className={`btn-primary flex-1 ${!canPublish ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                Publish
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Stats */}
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

                    {/* Recent posts */}
                    <div className="card mt-4">
                        <div className="px-4 py-3 border-b border-border">
                            <h4 className="section-label">Recent Posts</h4>
                        </div>
                        <div className="divide-y divide-border">
                            {mockBriefings.slice(0, 3).map((post) => (
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
