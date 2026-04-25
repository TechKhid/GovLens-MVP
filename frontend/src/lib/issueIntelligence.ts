import { BriefingPost, Issue } from '@/lib/mockData';

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'near', 'into', 'onto',
    'your', 'have', 'been', 'over', 'under', 'after', 'before', 'there', 'their',
    'about', 'road', 'street', 'issue', 'problem', 'report', 'reported', 'area',
]);

const ACTIVE_STATUSES = new Set<Issue['status']>([
    'Reported',
    'Acknowledged',
    'In Progress',
    'Pending Verification',
    'Reopened',
]);

export interface SimilarIssueDraft {
    title: string;
    description?: string;
    address?: string;
    zone?: string;
    sector?: Issue['sector'] | null;
}

export interface SimilarIssueHint {
    issue: Issue;
    score: number;
    label: 'High match' | 'Similar';
    reason: string;
}

export interface IssueCluster {
    key: string;
    zone: string;
    sector: Issue['sector'];
    count: number;
    highSeverityCount: number;
    activeCount: number;
    pendingVerificationCount: number;
    resolvedCount: number;
    averageUpvotes: number;
    latestSubmittedAt: string;
    issueIds: string[];
    topTitles: string[];
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(value: string): string[] {
    return Array.from(new Set(
        normalizeText(value)
            .split(' ')
            .map((token) => token.trim())
            .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    ));
}

function jaccardSimilarity(left: string[], right: string[]): number {
    if (left.length === 0 || right.length === 0) return 0;

    const leftSet = new Set(left);
    const rightSet = new Set(right);
    let intersection = 0;

    leftSet.forEach((token) => {
        if (rightSet.has(token)) {
            intersection += 1;
        }
    });

    const unionSet = new Set(left);
    right.forEach((token) => {
        unionSet.add(token);
    });
    const union = unionSet.size;
    return union === 0 ? 0 : intersection / union;
}

function sameNormalizedValue(left?: string, right?: string): boolean {
    return normalizeText(left ?? '') !== '' && normalizeText(left ?? '') === normalizeText(right ?? '');
}

export function findSimilarIssues(
    issues: Issue[],
    draft: SimilarIssueDraft,
    limit = 3
): SimilarIssueHint[] {
    if (draft.title.trim().length < 6) {
        return [];
    }

    const draftTitleTokens = tokenize(draft.title);
    const draftContextTokens = tokenize([
        draft.title,
        draft.description ?? '',
        draft.address ?? '',
    ].join(' '));

    return issues
        .map((issue) => {
            const issueTitleTokens = tokenize(issue.title);
            const issueContextTokens = tokenize([
                issue.title,
                issue.description,
                issue.location.address,
            ].join(' '));

            const titleScore = jaccardSimilarity(draftTitleTokens, issueTitleTokens);
            const contextScore = jaccardSimilarity(draftContextTokens, issueContextTokens);
            const zoneBonus = sameNormalizedValue(draft.zone, issue.zone) ? 0.15 : 0;
            const sectorBonus = draft.sector && draft.sector === issue.sector ? 0.15 : 0;
            const score = (titleScore * 0.55) + (contextScore * 0.30) + zoneBonus + sectorBonus;

            const reasons: string[] = [];
            if (titleScore >= 0.3) reasons.push('similar wording');
            if (zoneBonus > 0) reasons.push(`same zone (${issue.zone})`);
            if (sectorBonus > 0) reasons.push(`same sector (${issue.sector})`);
            if (ACTIVE_STATUSES.has(issue.status)) reasons.push(`still ${issue.status.toLowerCase()}`);

            return {
                issue,
                score,
                label: score >= 0.55 ? 'High match' as const : 'Similar' as const,
                reason: reasons.join(' - '),
            };
        })
        .filter((hint) => hint.score >= 0.28)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
}

export function buildIssueClusters(issues: Issue[], minCount = 2): IssueCluster[] {
    const clusterMap = new Map<string, Issue[]>();

    issues.forEach((issue) => {
        if (!issue.zone || !issue.sector) return;

        const key = `${normalizeText(issue.zone)}::${issue.sector}`;
        const existing = clusterMap.get(key) ?? [];
        existing.push(issue);
        clusterMap.set(key, existing);
    });

    return Array.from(clusterMap.entries())
        .map(([key, clusterIssues]) => {
            const sortedByDate = [...clusterIssues].sort((left, right) =>
                new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
            );
            const latestSubmittedAt = sortedByDate[0]?.submittedAt ?? new Date(0).toISOString();
            const highSeverityCount = clusterIssues.filter((issue) =>
                issue.severity === 'High' || issue.severity === 'Critical'
            ).length;
            const activeCount = clusterIssues.filter((issue) => ACTIVE_STATUSES.has(issue.status)).length;
            const pendingVerificationCount = clusterIssues.filter((issue) =>
                issue.status === 'Pending Verification'
            ).length;
            const resolvedCount = clusterIssues.filter((issue) =>
                issue.status === 'Verified Resolved'
            ).length;
            const averageUpvotes = Math.round(
                clusterIssues.reduce((sum, issue) => sum + issue.upvotes, 0) / clusterIssues.length
            );

            return {
                key,
                zone: clusterIssues[0].zone,
                sector: clusterIssues[0].sector,
                count: clusterIssues.length,
                highSeverityCount,
                activeCount,
                pendingVerificationCount,
                resolvedCount,
                averageUpvotes,
                latestSubmittedAt,
                issueIds: clusterIssues.map((issue) => issue.id),
                topTitles: sortedByDate.slice(0, 3).map((issue) => issue.title),
            };
        })
        .filter((cluster) => cluster.count >= minCount)
        .sort((left, right) => {
            if (right.count !== left.count) return right.count - left.count;
            if (right.highSeverityCount !== left.highSeverityCount) {
                return right.highSeverityCount - left.highSeverityCount;
            }
            return new Date(right.latestSubmittedAt).getTime() - new Date(left.latestSubmittedAt).getTime();
        });
}

export function buildBriefingDraftFromCluster(cluster: IssueCluster): Pick<BriefingPost, 'type' | 'title' | 'body' | 'sectors'> {
    const openSignal = cluster.activeCount > 0
        ? `${cluster.activeCount} cases are still active or awaiting citizen verification.`
        : 'The recent reports in this cluster have already moved into resolution or verification.';
    const severitySignal = cluster.highSeverityCount > 0
        ? `${cluster.highSeverityCount} of the reports in this cluster were marked high priority.`
        : 'Most reports in this cluster are routine, but the repeated pattern still needs attention.';
    const sampleTitles = cluster.topTitles.map((title) => `- ${title}`).join('\n');

    return {
        type: 'Briefing',
        title: `${cluster.sector} update for ${cluster.zone}`,
        sectors: [cluster.sector],
        body: [
            `GovLens grouped ${cluster.count} recent ${cluster.sector.toLowerCase()} reports in ${cluster.zone} into this draft briefing for office review.`,
            '',
            'Recent reports driving this briefing:',
            sampleTitles,
            '',
            'Current signal from the live issue cluster:',
            `- ${severitySignal}`,
            `- ${openSignal}`,
            `- ${cluster.resolvedCount} reports are already marked Verified Resolved.`,
            `- Average public support across the cluster is ${cluster.averageUpvotes} upvotes.`,
            '',
            'Suggested office response to review and edit:',
            '1. Confirm which authority is responsible for the issue pattern in this zone.',
            '2. State what the MP office has already done since the reports started clustering.',
            '3. Give residents one concrete next checkpoint or timeline to watch for.',
            '4. Clarify whether this needs a structural fix instead of one-off case handling.',
            '',
            'Human review note:',
            'This draft is based on live GovLens issue data and should be reviewed, corrected, and approved by the MP office before publication.',
        ].join('\n'),
    };
}
