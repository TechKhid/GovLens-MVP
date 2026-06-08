'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    Comment,
    Issue,
    Severity,
    Status,
    SEVERITIES,
    STAFF,
    SECTOR_COLORS,
    SECTOR_EMOJIS,
    SEVERITY_COLORS,
    STATUS_COLORS,
    formatDate,
    getTimeAgo,
} from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth } from '@/context/RoleContext';
import { getGhanaRoutingContext } from '@/lib/ghanaRouting';
import StatusPill from './StatusPill';
import SeverityPill from './SeverityPill';
import SectorTag from './SectorTag';

const LocationMiniMap = dynamic(() => import('./LocationMiniMap'), {
    ssr: false,
    loading: () => <div className="w-full h-[150px] rounded-2xl bg-background animate-pulse" />,
});

interface MPIssueWorkspaceProps {
    issue: Issue | null;
    onClose: () => void;
    isUpvoted?: boolean;
    onUpvote?: () => void;
}

export default function MPIssueWorkspace({
    issue,
    onClose,
    isUpvoted = false,
    onUpvote,
}: MPIssueWorkspaceProps) {
    const {
        addComment: publishComment,
        changeIssueStatus,
        loadComments,
        saveIssueManagement,
    } = useDataStore();
    const { user } = useAuth();

    const [status, setStatus] = useState<Status>(issue?.status ?? 'Reported');
    const [severity, setSeverity] = useState<Severity>(issue?.severity ?? 'Low');
    const [assignee, setAssignee] = useState(issue?.assignedTo ?? '');
    const [internalNote, setInternalNote] = useState(issue?.internalNotes ?? '');
    const [officialResponse, setOfficialResponse] = useState('');
    const [resolutionNote, setResolutionNote] = useState('');
    const [caseMessage, setCaseMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
    const [publishingState, setPublishingState] = useState<'idle' | 'saving'>('idle');
    const [savingState, setSavingState] = useState<'idle' | 'saving'>('idle');

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

        setOfficialResponse('');
        setResolutionNote('');
        setCaseMessage(null);
        setPublishingState('idle');
        setSavingState('idle');
        void loadComments(issueId);
    }, [issue?.id, loadComments]);

    if (!issue) {
        return (
            <section className="card border border-border bg-white">
                <div className="p-8">
                    <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-muted-text">
                        Issue workspace
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-semibold text-primary-text">
                        Select an issue to work the case
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-7 text-muted-text font-body">
                        Use the queue to pick a case. This workspace keeps context, official updates,
                        and operational controls in one place so the office does not need to jump across tabs.
                    </p>
                </div>
            </section>
        );
    }

    const currentIssue = issue;
    const routingContext = getGhanaRoutingContext(currentIssue, user?.constituency || 'Ayawaso West Wuogon');
    const statusOptions: Status[] = Array.from(new Set<Status>([
        currentIssue.status,
        'Acknowledged',
        'In Progress',
        'Pending Verification',
    ]));
    const publicUpdates = currentIssue.comments.filter((comment) => comment.isMPOffice);
    const latestPublicUpdate = publicUpdates.length > 0 ? publicUpdates[publicUpdates.length - 1] : null;
    const operationalChangesPending =
        status !== currentIssue.status
        || severity !== currentIssue.severity
        || assignee !== (currentIssue.assignedTo ?? '')
        || internalNote !== (currentIssue.internalNotes ?? '');

    async function handlePublishOfficialResponse() {
        const content = officialResponse.trim();
        if (!content) return;

        setPublishingState('saving');
        setCaseMessage(null);

        try {
            await publishComment(currentIssue.id, {
                author: 'MP Office',
                avatar: 'MP',
                content,
                timestamp: new Date().toISOString(),
                likes: 0,
                isMPOffice: true,
            });

            setOfficialResponse('');
            setCaseMessage({
                kind: 'success',
                text: 'Official response published to the public thread.',
            });
        } catch (error) {
            console.error('Failed to publish official response:', error);
            setCaseMessage({
                kind: 'error',
                text: error instanceof Error
                    ? error.message
                    : 'Failed to publish the official response. Please try again.',
            });
        } finally {
            setPublishingState('idle');
        }
    }

    async function handleSaveCaseChanges() {
        const trimmedResolutionNote = resolutionNote.trim();
        setSavingState('saving');
        setCaseMessage(null);

        try {
            if (status === 'Pending Verification' && !trimmedResolutionNote && currentIssue.status !== 'Pending Verification') {
                throw new Error('Add a resolution note before sending this case for citizen verification.');
            }

            if (status !== currentIssue.status) {
                await changeIssueStatus(currentIssue.id, status, trimmedResolutionNote || undefined);
            }

            await saveIssueManagement(currentIssue.id, {
                severity,
                assignedTo: assignee || undefined,
                internalNotes: internalNote || undefined,
            });

            setResolutionNote('');
            setCaseMessage({
                kind: 'success',
                text: 'Case changes saved.',
            });
        } catch (error) {
            console.error('Failed to save case changes:', error);
            setCaseMessage({
                kind: 'error',
                text: error instanceof Error ? error.message : 'Failed to save case changes.',
            });
        } finally {
            setSavingState('idle');
        }
    }

    return (
        <section className="card border border-border bg-white overflow-hidden">
            <div className="border-b border-border bg-[linear-gradient(135deg,#fffdf8_0%,#f7f3eb_100%)]">
                <div className="flex items-start justify-between gap-4 px-5 py-5">
                    <div className="min-w-0">
                        <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-muted-text">
                            Issue workspace
                        </p>
                        <h2 className="mt-2 font-display text-[28px] leading-tight font-semibold text-primary-text">
                            {currentIssue.title}
                        </h2>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-text">{currentIssue.id}</span>
                            <StatusPill status={currentIssue.status} />
                            <SeverityPill severity={currentIssue.severity} />
                            <SectorTag sector={currentIssue.sector} />
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-10 w-10 rounded-full border border-border bg-white text-muted-text hover:text-primary-text transition-colors"
                        aria-label="Close issue workspace"
                        title="Close issue workspace"
                    >
                        X
                    </button>
                </div>
            </div>

            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
                <div className="p-5 space-y-5">
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
                                <p className="mt-3 text-sm leading-7 text-primary-text font-body">
                                    {currentIssue.description}
                                </p>
                            </div>
                            <div className="min-w-[140px] rounded-2xl border border-border bg-background px-4 py-3">
                                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-muted-text">
                                    Snapshot
                                </p>
                                <div className="mt-3 space-y-2 text-sm font-body">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-text">Affected</span>
                                        <span className="font-semibold text-primary-text">
                                            {currentIssue.affectedResidents.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-text">Comments</span>
                                        <span className="font-semibold text-primary-text">{currentIssue.comments.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-text">Support</span>
                                        <button
                                            onClick={onUpvote}
                                            className={`font-semibold transition-colors ${isUpvoted ? 'text-primary-text' : 'text-muted-text hover:text-primary-text'}`}
                                        >
                                            {isUpvoted ? 'Supported' : 'Support'} ({currentIssue.upvotes})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                            <div className="rounded-2xl bg-background p-4">
                                <div className="flex items-center gap-2 text-sm font-body font-medium text-primary-text">
                                    <span className="text-lg">{SECTOR_EMOJIS[currentIssue.sector]}</span>
                                    <span>{currentIssue.location.address}</span>
                                </div>
                                <p className="mt-1 text-[11px] font-mono text-muted-text">
                                    {currentIssue.location.gps.lat.toFixed(4)}N, {Math.abs(currentIssue.location.gps.lng).toFixed(4)}W
                                </p>
                                <div className="mt-4 overflow-hidden rounded-2xl border border-border">
                                    <LocationMiniMap
                                        lat={currentIssue.location.gps.lat}
                                        lng={currentIssue.location.gps.lng}
                                        color={SECTOR_COLORS[currentIssue.sector]}
                                        height={150}
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-briefing-blue">
                                    Routing context
                                </p>
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Oversight owner</p>
                                        <p className="text-sm font-body font-medium text-primary-text">{routingContext.oversightOwner}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Likely responsible authority</p>
                                        <p className="text-sm font-body font-medium text-primary-text">{routingContext.likelyResponsibleAuthority}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide text-muted-text font-body">Committee</p>
                                        <p className="text-sm font-body font-medium text-primary-text">{routingContext.parliamentaryCommittee}</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-xs leading-6 text-muted-text font-body">
                                    {routingContext.authorityNote}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">
                                    Public update
                                </p>
                                <h3 className="mt-2 font-display text-xl font-semibold text-primary-text">
                                    Publish an official response
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-muted-text font-body">
                                    This posts directly into the citizen-facing thread. Use it for acknowledgements,
                                    progress notes, or a clear request for verification.
                                </p>
                            </div>
                            {latestPublicUpdate && (
                                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-right">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-briefing-blue">
                                        Latest office update
                                    </p>
                                    <p className="mt-1 text-xs font-body text-primary-text">{getTimeAgo(latestPublicUpdate.timestamp)}</p>
                                </div>
                            )}
                        </div>

                        <textarea
                            value={officialResponse}
                            onChange={(event) => setOfficialResponse(event.target.value)}
                            placeholder="Share the office response that citizens should see publicly."
                            className="textarea-field mt-4 h-28"
                        />

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-muted-text font-body">
                                Public updates appear in the issue thread immediately after publish.
                            </p>
                            <button
                                onClick={() => void handlePublishOfficialResponse()}
                                disabled={publishingState === 'saving' || !officialResponse.trim()}
                                className={`btn-primary text-sm px-5 ${publishingState === 'saving' || !officialResponse.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                                style={{ backgroundColor: '#1E3A8A' }}
                            >
                                {publishingState === 'saving' ? 'Publishing...' : 'Publish public update'}
                            </button>
                        </div>
                    </section>

                    <div className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
                        <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">
                                        Activity
                                    </p>
                                    <h3 className="mt-2 font-display text-xl font-semibold text-primary-text">
                                        Timeline and public thread
                                    </h3>
                                </div>
                                <div className="rounded-full bg-background px-3 py-1 text-xs font-mono text-muted-text">
                                    {currentIssue.comments.length} comments
                                </div>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div className="rounded-2xl bg-background p-4">
                                    <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">
                                        Status timeline
                                    </p>
                                    <div className="mt-4 space-y-4">
                                        {currentIssue.timeline.map((event, index) => (
                                            <div key={`${event.status}-${event.date}-${index}`} className="relative flex gap-3">
                                                {index < currentIssue.timeline.length - 1 && (
                                                    <div
                                                        className="absolute left-[7px] top-[18px] h-[calc(100%-4px)] w-[2px]"
                                                        style={{ backgroundColor: `${STATUS_COLORS[event.status]}33` }}
                                                    />
                                                )}
                                                <div
                                                    className="relative z-10 mt-1 h-4 w-4 rounded-full border-2 bg-white"
                                                    style={{ borderColor: STATUS_COLORS[event.status] }}
                                                />
                                                <div className="pb-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-body font-medium" style={{ color: STATUS_COLORS[event.status] }}>
                                                            {event.status}
                                                        </span>
                                                        <span className="text-xs font-mono text-muted-text">
                                                            {formatDate(event.date)}
                                                        </span>
                                                    </div>
                                                    {event.note && (
                                                        <p className="mt-1 text-sm leading-6 text-muted-text font-body">
                                                            {event.note}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {currentIssue.comments.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                                            <p className="text-sm font-body text-muted-text">
                                                No public conversation yet. Use the official response composer to post the first update.
                                            </p>
                                        </div>
                                    ) : (
                                        currentIssue.comments.map((comment) => (
                                            <WorkspaceCommentCard key={comment.id} comment={comment} />
                                        ))
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                            <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-text">
                                Operations
                            </p>
                            <h3 className="mt-2 font-display text-xl font-semibold text-primary-text">
                                Case controls
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-muted-text font-body">
                                Keep internal judgement and public communication separate. Save management changes here,
                                and use the public update composer for citizen-facing replies.
                            </p>

                            <div className="mt-5 space-y-5">
                                <div>
                                    <p className="section-label mb-2">Status</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {statusOptions.map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => setStatus(option)}
                                                className={`rounded-xl border px-3 py-3 text-left transition-colors ${status === option ? 'text-white' : 'bg-white text-primary-text border-border hover:bg-background'}`}
                                                style={status === option ? { backgroundColor: STATUS_COLORS[option], borderColor: STATUS_COLORS[option] } : {}}
                                            >
                                                <span className="block text-sm font-body font-medium">{option}</span>
                                                <span className={`mt-1 block text-[11px] font-body ${status === option ? 'text-white/80' : 'text-muted-text'}`}>
                                                    {option === 'Pending Verification'
                                                        ? 'Send to the reporter for confirmation.'
                                                        : option === 'In Progress'
                                                            ? 'Signal active follow-up and coordination.'
                                                            : option === 'Acknowledged'
                                                                ? 'Confirm the office has taken ownership.'
                                                                : 'Current state'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {status === 'Pending Verification' && (
                                    <div>
                                        <p className="section-label mb-2">Resolution note</p>
                                        <textarea
                                            value={resolutionNote}
                                            onChange={(event) => setResolutionNote(event.target.value)}
                                            placeholder="Explain exactly what changed before asking the reporter to verify the fix."
                                            className="textarea-field h-24"
                                        />
                                    </div>
                                )}

                                <div>
                                    <p className="section-label mb-2">Severity</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {SEVERITIES.map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => setSeverity(option)}
                                                className={`rounded-xl border px-3 py-3 text-left transition-colors ${severity === option ? 'text-white' : 'bg-white text-primary-text border-border hover:bg-background'}`}
                                                style={severity === option ? { backgroundColor: SEVERITY_COLORS[option], borderColor: SEVERITY_COLORS[option] } : {}}
                                            >
                                                <span className="block text-sm font-body font-medium">{option}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="section-label mb-2">Assign to staff</p>
                                    <select
                                        value={assignee}
                                        onChange={(event) => setAssignee(event.target.value)}
                                        className="input-field"
                                    >
                                        <option value="">Unassigned</option>
                                        {STAFF.map((staffer) => (
                                            <option key={staffer} value={staffer}>
                                                {staffer}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <p className="section-label mb-2">Internal note</p>
                                    <textarea
                                        value={internalNote}
                                        onChange={(event) => setInternalNote(event.target.value)}
                                        placeholder="Private working note for the MP office."
                                        className="textarea-field h-28"
                                        style={{ backgroundColor: '#FFFDF5' }}
                                    />
                                    <p className="mt-1 text-xs font-body text-muted-text">
                                        Citizens never see this note.
                                    </p>
                                </div>

                                {latestPublicUpdate && (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-briefing-blue">
                                            Last official response
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-primary-text font-body">
                                            {latestPublicUpdate.content}
                                        </p>
                                        <p className="mt-2 text-xs font-mono text-muted-text">
                                            {formatDate(latestPublicUpdate.timestamp)}
                                        </p>
                                    </div>
                                )}

                                <div className="rounded-2xl border border-dashed border-red-300 px-4 py-4">
                                    <button
                                        className="w-full text-sm font-body font-medium text-status-critical"
                                        type="button"
                                    >
                                        Planned agency referral (upcoming)
                                    </button>
                                    <p className="mt-2 text-xs leading-6 text-muted-text font-body text-center">
                                        This remains a finals-facing trace only. It does not notify any agency yet.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <div className="border-t border-border bg-white px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-[20px]">
                        {caseMessage && (
                            <p className={`text-sm font-body ${caseMessage.kind === 'error' ? 'text-status-critical' : 'text-status-resolved'}`}>
                                {caseMessage.text}
                            </p>
                        )}
                        {!caseMessage && (
                            <p className="text-xs font-body text-muted-text">
                                {operationalChangesPending
                                    ? 'You have unsaved case changes.'
                                    : 'Case controls are up to date.'}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => void handleSaveCaseChanges()}
                        disabled={savingState === 'saving'}
                        className={`btn-primary min-w-[180px] ${savingState === 'saving' ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {savingState === 'saving' ? 'Saving...' : 'Save case changes'}
                    </button>
                </div>
            </div>
        </section>
    );
}

function WorkspaceCommentCard({ comment }: { comment: Comment }) {
    return (
        <article
            className={`rounded-2xl border p-4 ${comment.isMPOffice ? 'border-blue-100 bg-blue-50' : 'border-border bg-white'}`}
        >
            <div className="flex items-center gap-2">
                <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold ${comment.isMPOffice ? 'bg-primary-text text-white' : 'bg-background text-muted-text'}`}
                >
                    {comment.avatar}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-body font-medium text-primary-text">{comment.author}</p>
                        {comment.isMPOffice && (
                            <span className="rounded-full bg-primary-text px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-white">
                                MP office
                            </span>
                        )}
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
