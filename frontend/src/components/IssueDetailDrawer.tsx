'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    Comment,
    Issue,
    Severity,
    Status,
    SEVERITIES,
    SEVERITY_COLORS,
    STAFF,
    SECTOR_COLORS,
    STATUS_COLORS,
    formatDate,
    getTimeAgo,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth, useRole } from '@/context/RoleContext';
import { getGhanaRoutingContext } from '@/lib/ghanaRouting';
import SectorTag from './SectorTag';
import SeverityPill from './SeverityPill';
import StatusPill from './StatusPill';

const LocationMiniMap = dynamic(() => import('./LocationMiniMap'), {
    ssr: false,
    loading: () => <div className="w-full h-[140px] rounded-2xl bg-background animate-pulse" />,
});

type DrawerTab = 'summary' | 'thread' | 'actions';

interface IssueDetailDrawerProps {
    issue: Issue | null;
    onClose: () => void;
    isUpvoted?: boolean;
    onUpvote?: () => void;
}

export default function IssueDetailDrawer({
    issue,
    onClose,
    isUpvoted = false,
    onUpvote,
}: IssueDetailDrawerProps) {
    const { addComment, changeIssueStatus, loadComments, saveIssueManagement, verifyIssue } = useDataStore();
    const { user } = useAuth();
    const { role } = useRole();

    const [activeTab, setActiveTab] = useState<DrawerTab>('summary');
    const [newComment, setNewComment] = useState('');
    const [status, setStatus] = useState<Status>(issue?.status ?? 'Reported');
    const [severity, setSeverity] = useState<Severity>(issue?.severity ?? 'Low');
    const [assignee, setAssignee] = useState(issue?.assignedTo ?? '');
    const [internalNote, setInternalNote] = useState(issue?.internalNotes ?? '');
    const [officialResponse, setOfficialResponse] = useState('');
    const [resolutionNote, setResolutionNote] = useState('');
    const [feedback, setFeedback] = useState<string>('');

    useEffect(() => {
        if (!issue) return;
        setStatus(issue.status);
        setSeverity(issue.severity);
        setAssignee(issue.assignedTo ?? '');
        setInternalNote(issue.internalNotes ?? '');
    }, [issue]);

    useEffect(() => {
        const issueId = issue?.id;
        if (!issueId) return;
        setActiveTab('summary');
        setNewComment('');
        setOfficialResponse('');
        setResolutionNote('');
        setFeedback('');
        void loadComments(issueId);
    }, [issue?.id, loadComments]);

    if (!issue) return null;

    const currentIssue = issue;
    const tabs: DrawerTab[] = role === 'mp' ? ['summary', 'thread', 'actions'] : ['summary', 'thread'];
    const isReporter = !!user?.sub && currentIssue.reporterId === user.sub;
    const routingContext = getGhanaRoutingContext(currentIssue, user?.constituency || 'Ayawaso West Wuogon');
    const latestPublicUpdate = [...currentIssue.comments].reverse().find((comment) => comment.isMPOffice) ?? null;
    const statusOptions: Status[] = Array.from(new Set<Status>([
        currentIssue.status,
        'Acknowledged',
        'In Progress',
        'Pending Verification',
    ]));

    const postComment = async () => {
        if (!newComment.trim()) return;
        try {
            await addComment(currentIssue.id, {
                author: role === 'mp' ? 'MP Office' : user?.name || 'You',
                avatar: role === 'mp' ? 'MP' : 'YO',
                content: newComment.trim(),
                timestamp: new Date().toISOString(),
                likes: 0,
                isMPOffice: role === 'mp',
            });
            setNewComment('');
            setFeedback('Comment posted.');
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Failed to post comment.');
        }
    };

    const publishOfficialResponse = async () => {
        if (!officialResponse.trim()) return;
        try {
            await addComment(currentIssue.id, {
                author: 'MP Office',
                avatar: 'MP',
                content: officialResponse.trim(),
                timestamp: new Date().toISOString(),
                likes: 0,
                isMPOffice: true,
            });
            setOfficialResponse('');
            setFeedback('Official response published.');
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Failed to publish official response.');
        }
    };

    const saveActions = async () => {
        try {
            const note = resolutionNote.trim();
            if (status === 'Pending Verification' && !note && currentIssue.status !== 'Pending Verification') {
                throw new Error('Add a resolution note before requesting verification.');
            }
            if (status !== currentIssue.status) {
                await changeIssueStatus(currentIssue.id, status, note || undefined);
            }
            await saveIssueManagement(currentIssue.id, {
                severity,
                assignedTo: assignee || undefined,
                internalNotes: internalNote || undefined,
            });
            setResolutionNote('');
            setFeedback('Case controls saved.');
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Failed to save case controls.');
        }
    };

    return (
        <>
            <div className="drawer-overlay animate-fade-in backdrop-blur-[2px]" onClick={onClose} />
            <div className="drawer-panel animate-slide-in-right w-full max-w-[620px] border-l shadow-[-18px_0_40px_rgba(17,24,39,0.12)]">
                <div className="sticky top-0 z-20 border-b border-border bg-white">
                    <div className="border-b border-border bg-[linear-gradient(135deg,#fffefb_0%,#f4ede2_55%,#ffffff_100%)] px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-muted-text">Civic case file</p>
                                <h2 className="mt-2 font-display text-[26px] leading-tight font-semibold text-primary-text">{currentIssue.title}</h2>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-[11px] text-muted-text">{currentIssue.id}</span>
                                    <StatusPill status={currentIssue.status} />
                                    <SeverityPill severity={currentIssue.severity} />
                                    <SectorTag sector={currentIssue.sector} />
                                </div>
                            </div>
                            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-text hover:text-primary-text" onClick={onClose} type="button">
                                X
                            </button>
                        </div>
                    </div>
                    <div className="px-5 py-3">
                        <div className="inline-flex rounded-full border border-border bg-background p-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    className={`rounded-full px-4 py-2 text-sm font-body font-medium capitalize transition-colors ${activeTab === tab ? 'bg-white text-primary-text shadow-[0_6px_16px_rgba(17,24,39,0.08)]' : 'text-muted-text hover:text-primary-text'}`}
                                    onClick={() => setActiveTab(tab)}
                                    type="button"
                                >
                                    {tab}
                                    {tab === 'thread' && <span className="ml-1 font-mono text-[11px]">({currentIssue.comments.length})</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-5 py-5">
                    {feedback && (
                        <div className={`mb-5 rounded-2xl border px-4 py-3 ${feedback.toLowerCase().includes('failed') || feedback.toLowerCase().includes('add ') ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                            <p className={`text-sm font-body ${feedback.toLowerCase().includes('failed') || feedback.toLowerCase().includes('add ') ? 'text-status-critical' : 'text-status-resolved'}`}>
                                {feedback}
                            </p>
                        </div>
                    )}

                    {activeTab === 'summary' && (
                        <div className="space-y-5">
                            <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.05)]">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text font-body">
                                            <span>{currentIssue.reporter.name}</span>
                                            <span className="font-mono">/</span>
                                            <span>{currentIssue.zone}</span>
                                            <span className="font-mono">/</span>
                                            <span>{formatDate(currentIssue.submittedAt)}</span>
                                        </div>
                                        <p className="mt-3 text-sm leading-7 text-primary-text font-body">{currentIssue.description}</p>
                                    </div>
                                    <div className="min-w-[150px] rounded-2xl border border-border bg-background px-4 py-3">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-muted-text">Snapshot</p>
                                        <div className="mt-3 space-y-2 text-sm font-body">
                                            <MetricRow label="Affected" value={currentIssue.affectedResidents.toLocaleString()} />
                                            <MetricRow label="Comments" value={String(currentIssue.comments.length)} />
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-text">Support</span>
                                                <button className={`font-semibold transition-colors ${isUpvoted ? 'text-primary-text' : 'text-muted-text hover:text-primary-text'}`} onClick={() => onUpvote?.()} type="button">
                                                    {isUpvoted ? 'Supported' : 'Support'} ({currentIssue.upvotes})
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                                    <div className="rounded-2xl bg-background p-4">
                                        <p className="text-sm font-body font-medium text-primary-text">{currentIssue.location.address}</p>
                                        <p className="mt-1 text-[11px] font-mono text-muted-text">
                                            {currentIssue.location.gps.lat.toFixed(4)}N, {Math.abs(currentIssue.location.gps.lng).toFixed(4)}W
                                        </p>
                                        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
                                            <LocationMiniMap
                                                lat={currentIssue.location.gps.lat}
                                                lng={currentIssue.location.gps.lng}
                                                color={SECTOR_COLORS[currentIssue.sector]}
                                                height={140}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-briefing-blue">Routing context</p>
                                        <div className="mt-3 space-y-3">
                                            <MetricBlock label="Oversight owner" value={routingContext.oversightOwner} />
                                            <MetricBlock label="Likely responsible authority" value={routingContext.likelyResponsibleAuthority} />
                                            <MetricBlock label="Committee" value={routingContext.parliamentaryCommittee} />
                                        </div>
                                        <p className="mt-3 text-xs leading-6 text-muted-text font-body">{routingContext.authorityNote}</p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                                <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Status history</p>
                                <div className="mt-4 space-y-4">
                                    {currentIssue.timeline.map((event, index) => (
                                        <div key={`${event.status}-${event.date}-${index}`} className="relative flex gap-3">
                                            {index < currentIssue.timeline.length - 1 && (
                                                <div className="absolute left-[7px] top-[18px] h-[calc(100%-4px)] w-[2px]" style={{ backgroundColor: `${STATUS_COLORS[event.status]}33` }} />
                                            )}
                                            <div className="relative z-10 mt-1 h-4 w-4 rounded-full border-2 bg-white" style={{ borderColor: STATUS_COLORS[event.status] }} />
                                            <div className="pb-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-body font-medium" style={{ color: STATUS_COLORS[event.status] }}>{event.status}</span>
                                                    <span className="text-xs font-mono text-muted-text">{formatDate(event.date)}</span>
                                                </div>
                                                {event.note && <p className="mt-1 text-sm leading-6 text-muted-text font-body">{event.note}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'thread' && (
                        <div className="space-y-5">
                            {role !== 'mp' && (
                                <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                                    <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Add a comment</p>
                                    <textarea className="textarea-field mt-4 h-24" onChange={(event) => setNewComment(event.target.value)} placeholder="Write your comment..." value={newComment} />
                                    <div className="mt-3 flex justify-end">
                                        <button className={`btn-primary ${!newComment.trim() ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!newComment.trim()} onClick={() => void postComment()} type="button">
                                            Post comment
                                        </button>
                                    </div>
                                </section>
                            )}

                            {currentIssue.status === 'Pending Verification' && isReporter && (
                                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-amber-700">Reporter verification</p>
                                    <p className="mt-2 text-sm leading-6 text-primary-text font-body">
                                        The MP office says this issue is fixed. Confirm it, or reopen the case if the issue remains.
                                    </p>
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <button className="btn-primary" onClick={() => void verifyIssue(currentIssue.id, 'confirm', newComment)} type="button">Confirm fixed</button>
                                        <button className="btn-secondary" onClick={() => void verifyIssue(currentIssue.id, 'dispute', newComment)} type="button">Still unresolved</button>
                                    </div>
                                </section>
                            )}

                            <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Conversation</p>
                                        <h3 className="mt-2 font-display text-xl font-semibold text-primary-text">Public thread and office updates</h3>
                                    </div>
                                    <div className="rounded-full bg-background px-3 py-1 text-xs font-mono text-muted-text">{currentIssue.comments.length} comments</div>
                                </div>
                                <div className="mt-4 space-y-3">
                                    {currentIssue.comments.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                                            <p className="text-sm font-body text-muted-text">No public conversation yet.</p>
                                        </div>
                                    ) : (
                                        currentIssue.comments.map((comment) => <DrawerCommentItem key={comment.id} comment={comment} />)
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'actions' && role === 'mp' && (
                        <div className="space-y-5">
                            <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Official response</p>
                                        <h3 className="mt-2 font-display text-xl font-semibold text-primary-text">Publish a public office update</h3>
                                    </div>
                                    {latestPublicUpdate && (
                                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-right">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-briefing-blue">Latest office update</p>
                                            <p className="mt-1 text-xs font-body text-primary-text">{getTimeAgo(latestPublicUpdate.timestamp)}</p>
                                        </div>
                                    )}
                                </div>
                                <textarea className="textarea-field mt-4 h-28" onChange={(event) => setOfficialResponse(event.target.value)} placeholder="Write the update citizens should see publicly." value={officialResponse} />
                                <div className="mt-3 flex justify-end">
                                    <button className={`btn-primary ${!officialResponse.trim() ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!officialResponse.trim()} onClick={() => void publishOfficialResponse()} style={{ backgroundColor: '#1E3A8A' }} type="button">
                                        Publish response
                                    </button>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                                <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">Case controls</p>
                                <div className="mt-5 space-y-5">
                                    <div>
                                        <p className="section-label mb-2">Status</p>
                                        <select className="input-field" onChange={(event) => setStatus(event.target.value as Status)} value={status}>
                                            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                    </div>

                                    {status === 'Pending Verification' && (
                                        <div>
                                            <p className="section-label mb-2">Resolution note</p>
                                            <textarea className="textarea-field h-24" onChange={(event) => setResolutionNote(event.target.value)} placeholder="Explain what changed before requesting verification." value={resolutionNote} />
                                        </div>
                                    )}

                                    <div>
                                        <p className="section-label mb-2">Severity</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {SEVERITIES.map((option) => (
                                                <button
                                                    key={option}
                                                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${severity === option ? 'text-white' : 'bg-white text-primary-text border-border hover:bg-background'}`}
                                                    onClick={() => setSeverity(option)}
                                                    style={severity === option ? { backgroundColor: SEVERITY_COLORS[option], borderColor: SEVERITY_COLORS[option] } : {}}
                                                    type="button"
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="section-label mb-2">Assign to staff</p>
                                        <select className="input-field" onChange={(event) => setAssignee(event.target.value)} value={assignee}>
                                            <option value="">Unassigned</option>
                                            {STAFF.map((staffer) => <option key={staffer} value={staffer}>{staffer}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <p className="section-label mb-2">Internal note</p>
                                        <textarea className="textarea-field h-28" onChange={(event) => setInternalNote(event.target.value)} placeholder="Private working note for the MP office." style={{ backgroundColor: '#FFFDF5' }} value={internalNote} />
                                    </div>
                                </div>
                                <div className="mt-5 flex justify-end border-t border-border pt-4">
                                    <button className="btn-primary min-w-[180px]" onClick={() => void saveActions()} type="button">Save case changes</button>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function DrawerCommentItem({ comment }: { comment: Comment }) {
    return (
        <article className={`rounded-2xl border p-4 ${comment.isMPOffice ? 'border-blue-100 bg-blue-50' : 'border-border bg-white'}`}>
            <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold ${comment.isMPOffice ? 'bg-primary-text text-white' : 'bg-background text-muted-text'}`}>
                    {comment.avatar}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-body font-medium text-primary-text">{comment.author}</p>
                        {comment.isMPOffice && <span className="rounded-full bg-primary-text px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-white">MP office</span>}
                    </div>
                    <p className="text-xs font-mono text-muted-text">{getTimeAgo(comment.timestamp)}</p>
                </div>
            </div>
            <p className={`mt-3 text-sm leading-7 font-body ${comment.isMPOffice ? 'text-briefing-blue' : 'text-primary-text'}`}>
                {comment.content}
            </p>
        </article>
    );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">{label}</p>
            <p className="text-sm font-body font-medium text-primary-text">{value}</p>
        </div>
    );
}

function MetricRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-text">{label}</span>
            <span className="font-semibold text-primary-text">{value}</span>
        </div>
    );
}
