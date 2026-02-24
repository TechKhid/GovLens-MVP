'use client';

import { Issue, SECTOR_COLORS, SECTOR_EMOJIS, getTimeAgo } from '@/lib/mockData';
import StatusPill from './StatusPill';
import SectorTag from './SectorTag';

interface IssueCardProps {
    issue: Issue;
    onClick: () => void;
    onUpvote?: (e: React.MouseEvent) => void;
    isUpvoted?: boolean;
    upvoteBoost?: number;
}

export default function IssueCard({ issue, onClick, onUpvote, isUpvoted = false, upvoteBoost = 0 }: IssueCardProps) {
    const sectorColor = SECTOR_COLORS[issue.sector];
    const sectorEmoji = SECTOR_EMOJIS[issue.sector];

    return (
        <div
            onClick={onClick}
            className="card p-4 cursor-pointer hover:shadow-sm transition-shadow group"
        >
            <div className="flex gap-3">
                {/* Photo thumbnail or sector emoji */}
                <div
                    className="w-[60px] h-[60px] rounded flex-shrink-0 flex items-center justify-center text-2xl"
                    style={{ backgroundColor: sectorColor + '15' }}
                >
                    {issue.photos.length > 0 ? (
                        <div
                            className="w-full h-full rounded bg-cover bg-center"
                            style={{ backgroundImage: `url(${issue.photos[0]})` }}
                        />
                    ) : (
                        sectorEmoji
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h4 className="font-display text-sm font-semibold text-primary-text leading-tight mb-1 group-hover:underline line-clamp-1">
                        {issue.title}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-muted-text font-body line-clamp-2 mb-2 leading-relaxed">
                        {issue.description}
                    </p>

                    {/* Reporter + Meta */}
                    <div className="flex items-center gap-2 mb-2">
                        <div
                            className="w-5 h-5 rounded-full bg-background flex items-center justify-center text-[10px] font-body font-medium text-muted-text flex-shrink-0"
                        >
                            {issue.reporter.avatar}
                        </div>
                        <span className="text-xs text-muted-text font-body truncate">
                            {issue.reporter.name}
                        </span>
                        <span className="text-xs text-muted-text">·</span>
                        <span className="text-xs text-muted-text font-body">
                            {issue.zone}
                        </span>
                        <span className="text-xs text-muted-text">·</span>
                        <span className="text-xs text-muted-text font-mono">
                            {getTimeAgo(issue.submittedAt)}
                        </span>
                    </div>

                    {/* Tags + Stats row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                            <SectorTag sector={issue.sector} />
                            <StatusPill status={issue.status} />
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-text flex-shrink-0">
                            {/* Affected count */}
                            <span className="font-mono" title="Affected residents">
                                {issue.affectedResidents.toLocaleString()}
                            </span>

                            {/* Comments */}
                            <span className="flex items-center gap-1" title="Comments">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M2 3h12v8H5l-3 3V3z" />
                                </svg>
                                <span className="font-mono">{issue.comments.length}</span>
                            </span>

                            {/* Upvote */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpvote?.(e);
                                }}
                                className={`flex items-center gap-1 cursor-pointer transition-colors ${isUpvoted ? 'text-primary-text' : 'hover:text-primary-text'
                                    }`}
                                title="Upvote"
                            >
                                <span className="text-sm">{isUpvoted ? '▲' : '△'}</span>
                                <span className="font-mono">{issue.upvotes + upvoteBoost}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
