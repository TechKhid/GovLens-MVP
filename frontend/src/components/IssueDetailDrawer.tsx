'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
    Issue, Comment, Status, Severity, STATUSES, SEVERITIES, STAFF,
    STATUS_COLORS, SEVERITY_COLORS, SECTOR_COLORS, SECTOR_EMOJIS,
    formatDate, getTimeAgo,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useRole } from '@/context/RoleContext';
import StatusPill from './StatusPill';
import SeverityPill from './SeverityPill';
import SectorTag from './SectorTag';

const LocationMiniMap = dynamic(() => import('./LocationMiniMap'), {
    ssr: false,
    loading: () => <div className="w-full h-[120px] bg-background rounded border border-border animate-pulse" />,
});

interface IssueDetailDrawerProps {
    issue: Issue | null;
    onClose: () => void;
    isUpvoted?: boolean;
    onUpvote?: () => void;
}

export default function IssueDetailDrawer({ issue, onClose, isUpvoted = false, onUpvote }: IssueDetailDrawerProps) {
    const { addComment: ctxAddComment, updateIssue } = useDataStore();
    const { role } = useRole();
    const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'manage'>('details');
    const [newComment, setNewComment] = useState('');
    const [status, setStatus] = useState<Status>(issue?.status || 'Reported');
    const [severity, setSeverity] = useState<Severity>(issue?.severity || 'Low');
    const [assignee, setAssignee] = useState(issue?.assignedTo || '');
    const [internalNote, setInternalNote] = useState(issue?.internalNotes || '');
    const [officialResponse, setOfficialResponse] = useState('');
    const [showResponseField, setShowResponseField] = useState(false);

    if (!issue) return null;

    const sectorColor = SECTOR_COLORS[issue.sector];
    const tabs = role === 'mp'
        ? ['details', 'comments', 'manage'] as const
        : ['details', 'comments'] as const;

    return (
        <>
            {/* Overlay */}
            <div className="drawer-overlay animate-fade-in" onClick={onClose} />

            {/* Panel */}
            <div className="drawer-panel animate-slide-in-right w-full max-w-[540px]">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-border z-10">
                    <div className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-text">{issue.id}</span>
                            <StatusPill status={issue.status} />
                            <SeverityPill severity={issue.severity} />
                            <SectorTag sector={issue.sector} />
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center text-muted-text hover:text-primary-text cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-border px-5">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`tab-button capitalize ${activeTab === tab ? 'tab-button-active' : ''}`}
                            >
                                {tab}
                                {tab === 'comments' && (
                                    <span className="ml-1 font-mono text-xs">({issue.comments.length})</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* ── Details Tab ─────────────────────── */}
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            {/* Title */}
                            <h3 className="font-display text-xl font-bold leading-tight">
                                {issue.title}
                            </h3>

                            {/* Photo strip */}
                            <div className="flex gap-2 overflow-x-auto">
                                {issue.photos.length > 0 ? (
                                    issue.photos.map((photo, i) => (
                                        <div
                                            key={i}
                                            className="w-[140px] h-[100px] rounded bg-cover bg-center flex-shrink-0 border border-border"
                                            style={{ backgroundImage: `url(${photo})` }}
                                        />
                                    ))
                                ) : (
                                    <div
                                        className="w-full h-[100px] rounded flex items-center justify-center text-4xl"
                                        style={{ backgroundColor: sectorColor + '10' }}
                                    >
                                        {SECTOR_EMOJIS[issue.sector]}
                                    </div>
                                )}
                            </div>

                            {/* Reporter */}
                            <div className="flex items-center gap-3 p-3 bg-background rounded">
                                <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-sm font-body font-medium text-muted-text">
                                    {issue.reporter.avatar}
                                </div>
                                <div>
                                    <p className="text-sm font-body font-medium">{issue.reporter.name}</p>
                                    <p className="text-xs text-muted-text font-body">
                                        Submitted {formatDate(issue.submittedAt)} · {issue.affectedResidents.toLocaleString()} residents affected
                                    </p>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <p className="section-label mb-2">Description</p>
                                <p className="text-sm font-body text-primary-text leading-[1.7]">
                                    {issue.description}
                                </p>
                            </div>

                            {/* Location */}
                            <div>
                                <p className="section-label mb-2">Location</p>
                                <p className="text-sm font-body mb-1">{issue.location.address}</p>
                                <p className="text-xs font-mono text-muted-text mb-3">
                                    {issue.location.gps.lat.toFixed(4)}°N, {Math.abs(issue.location.gps.lng).toFixed(4)}°W
                                </p>
                                {/* Mini map tile */}
                                <LocationMiniMap
                                    lat={issue.location.gps.lat}
                                    lng={issue.location.gps.lng}
                                    color={sectorColor}
                                    height={120}
                                />
                            </div>

                            {/* Status Timeline */}
                            <div>
                                <p className="section-label mb-3">Status Timeline</p>
                                <div className="space-y-0">
                                    {issue.timeline.map((event, i) => (
                                        <div key={i} className="flex gap-3 relative">
                                            {/* Connector line */}
                                            {i < issue.timeline.length - 1 && (
                                                <div
                                                    className="absolute left-[7px] top-[18px] w-[2px] h-[calc(100%)]"
                                                    style={{ backgroundColor: STATUS_COLORS[event.status] + '30' }}
                                                />
                                            )}
                                            {/* Dot */}
                                            <div
                                                className="w-[16px] h-[16px] rounded-full flex-shrink-0 mt-0.5 border-2 bg-white z-10"
                                                style={{ borderColor: STATUS_COLORS[event.status] }}
                                            />
                                            {/* Content */}
                                            <div className="pb-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-body font-medium" style={{ color: STATUS_COLORS[event.status] }}>
                                                        {event.status}
                                                    </span>
                                                    <span className="text-xs font-mono text-muted-text">
                                                        {formatDate(event.date)}
                                                    </span>
                                                </div>
                                                {event.note && (
                                                    <p className="text-xs text-muted-text font-body mt-0.5">{event.note}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Upvote + Comments shortcut */}
                            <div className="flex items-center gap-4 pt-2 border-t border-border">
                                <button
                                    onClick={() => onUpvote?.()}
                                    className={`flex items-center gap-1.5 text-sm cursor-pointer transition-colors ${isUpvoted ? 'text-primary-text' : 'text-muted-text hover:text-primary-text'
                                        }`}
                                >
                                    <span>{isUpvoted ? '▲' : '△'}</span>
                                    <span className="font-mono">{issue.upvotes + (isUpvoted ? 1 : 0)}</span>
                                    <span className="font-body">Upvote</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('comments')}
                                    className="flex items-center gap-1.5 text-sm text-muted-text hover:text-primary-text cursor-pointer"
                                >
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M2 3h12v8H5l-3 3V3z" />
                                    </svg>
                                    <span className="font-mono">{issue.comments.length}</span>
                                    <span className="font-body">Comments</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Comments Tab ───────────────────── */}
                    {activeTab === 'comments' && (
                        <div className="space-y-4">
                            {/* Compose */}
                            <div className="space-y-2">
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="textarea-field h-20"
                                />
                                <div className="flex justify-end">
                                    <button
                                        disabled={!newComment.trim()}
                                        onClick={() => {
                                            if (!newComment.trim() || !issue) return;
                                            ctxAddComment(issue.id, {
                                                author: role === 'mp' ? 'MP Office' : 'You',
                                                avatar: role === 'mp' ? 'MP' : 'YO',
                                                content: newComment.trim(),
                                                timestamp: new Date().toISOString(),
                                                likes: 0,
                                                isMPOffice: role === 'mp',
                                            });
                                            setNewComment('');
                                        }}
                                        className={`btn-primary text-xs ${!newComment.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        Post
                                    </button>
                                </div>
                            </div>

                            {/* Comments list */}
                            {issue.comments.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-text font-body">No comments yet. Be the first to respond.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {issue.comments.map((comment) => (
                                        <CommentItem key={comment.id} comment={comment} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Manage Tab (MP Only) ───────────── */}
                    {activeTab === 'manage' && role === 'mp' && (
                        <div className="space-y-6">
                            {/* Status */}
                            <div>
                                <p className="section-label mb-2">Status</p>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Status)}
                                    className="input-field"
                                >
                                    {STATUSES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Severity */}
                            <div>
                                <p className="section-label mb-2">Severity</p>
                                <div className="flex gap-2">
                                    {SEVERITIES.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setSeverity(s)}
                                            className={`flex-1 py-2 text-xs font-body font-medium border cursor-pointer transition-all ${severity === s
                                                ? 'text-white'
                                                : 'bg-white text-primary-text border-border hover:bg-background'
                                                }`}
                                            style={severity === s ? {
                                                backgroundColor: SEVERITY_COLORS[s],
                                                borderColor: SEVERITY_COLORS[s],
                                            } : {}}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Assign */}
                            <div>
                                <p className="section-label mb-2">Assign to Staff</p>
                                <select
                                    value={assignee}
                                    onChange={(e) => setAssignee(e.target.value)}
                                    className="input-field"
                                >
                                    <option value="">Unassigned</option>
                                    {STAFF.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Internal Note */}
                            <div>
                                <p className="section-label mb-2">Internal Note</p>
                                <textarea
                                    value={internalNote}
                                    onChange={(e) => setInternalNote(e.target.value)}
                                    placeholder="Private — visible to MP office only."
                                    className="textarea-field h-24"
                                    style={{ backgroundColor: '#FFFDF5' }}
                                />
                                <p className="text-[10px] text-muted-text mt-1 font-body">
                                    This note is private and will not be visible to citizens.
                                </p>
                            </div>

                            {/* Official Response */}
                            <div>
                                <p className="section-label mb-2">Official Response</p>
                                {!showResponseField ? (
                                    <button
                                        onClick={() => setShowResponseField(true)}
                                        className="btn-secondary w-full text-xs"
                                        style={{ borderColor: '#1E3A8A', color: '#1E3A8A' }}
                                    >
                                        + Add Official Response
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <textarea
                                            value={officialResponse}
                                            onChange={(e) => setOfficialResponse(e.target.value)}
                                            placeholder="This response will be visible to citizens as an MP Office comment."
                                            className="textarea-field h-24"
                                            style={{ borderColor: '#1E3A8A' }}
                                        />
                                        <button
                                            disabled={!officialResponse.trim()}
                                            onClick={() => {
                                                if (!officialResponse.trim() || !issue) return;
                                                ctxAddComment(issue.id, {
                                                    author: 'MP Office',
                                                    avatar: 'MP',
                                                    content: officialResponse.trim(),
                                                    timestamp: new Date().toISOString(),
                                                    likes: 0,
                                                    isMPOffice: true,
                                                });
                                                setOfficialResponse('');
                                                setShowResponseField(false);
                                            }}
                                            className={`btn-primary w-full text-xs ${!officialResponse.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            style={{ backgroundColor: '#1E3A8A' }}
                                        >
                                            Publish Response
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Save Changes */}
                            <div>
                                <button
                                    onClick={() => {
                                        if (!issue) return;
                                        updateIssue(issue.id, {
                                            status,
                                            severity,
                                            assignedTo: assignee || undefined,
                                            internalNotes: internalNote || undefined,
                                        });
                                    }}
                                    className="btn-primary w-full text-xs"
                                >
                                    Save Changes
                                </button>
                            </div>

                            {/* Escalate */}
                            <div>
                                <button
                                    className="w-full py-3 text-xs font-body font-medium border-2 border-dashed text-status-critical cursor-pointer hover:bg-red-50 transition-colors"
                                    style={{ borderColor: '#C62828' }}
                                >
                                    Escalate to GHA / MOFEP / GES
                                </button>
                                <p className="text-[10px] text-muted-text mt-1 font-body text-center">
                                    Triggers a formal referral workflow (visual only in prototype)
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Comment Item ────────────────────────────────────────────

function CommentItem({ comment }: { comment: Comment }) {
    const [liked, setLiked] = useState(false);

    return (
        <div
            className={`p-3 rounded ${comment.isMPOffice ? 'border border-blue-100' : ''
                }`}
            style={comment.isMPOffice ? { backgroundColor: '#F0F4FF' } : {}}
        >
            <div className="flex items-center gap-2 mb-2">
                <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-body font-medium flex-shrink-0 ${comment.isMPOffice
                        ? 'bg-primary-text text-white'
                        : 'bg-background text-muted-text'
                        }`}
                >
                    {comment.avatar}
                </div>
                <span className="text-sm font-body font-medium">
                    {comment.author}
                </span>
                {comment.isMPOffice && (
                    <span className="px-1.5 py-0.5 bg-primary-text text-white text-[9px] font-body font-medium tracking-wider">
                        MP OFFICE
                    </span>
                )}
                <span className="text-xs font-mono text-muted-text ml-auto">
                    {getTimeAgo(comment.timestamp)}
                </span>
            </div>
            <p
                className={`text-sm font-body leading-relaxed ${comment.isMPOffice ? 'text-briefing-blue' : 'text-primary-text'
                    }`}
            >
                {comment.content}
            </p>
            <div className="flex items-center gap-1 mt-2">
                <button
                    onClick={() => setLiked(!liked)}
                    className={`text-xs cursor-pointer transition-colors ${liked ? 'text-red-500' : 'text-muted-text hover:text-red-400'}`}
                >
                    {liked ? '♥' : '♡'}
                </button>
                <span className="text-xs font-mono text-muted-text">
                    {comment.likes + (liked ? 1 : 0)}
                </span>
            </div>
        </div>
    );
}
