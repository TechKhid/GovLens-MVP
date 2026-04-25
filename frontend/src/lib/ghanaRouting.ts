import type { Issue } from '@/lib/mockData';

export interface GhanaRoutingContext {
    oversightOwner: string;
    likelyResponsibleAuthority: string;
    parliamentaryCommittee: string;
    authorityNote: string;
}

const ROUTING_BY_SECTOR: Record<Issue['sector'], Omit<GhanaRoutingContext, 'oversightOwner'>> = {
    Infrastructure: {
        likelyResponsibleAuthority: 'Ayawaso West Municipal Assembly or the relevant utility provider',
        parliamentaryCommittee: 'Local Government and Rural Development',
        authorityNote: 'The MP can push for action and follow up publicly, but delivery usually sits with the municipal assembly or utility.',
    },
    Sanitation: {
        likelyResponsibleAuthority: 'Ayawaso West Municipal Assembly sanitation or waste management unit',
        parliamentaryCommittee: 'Sanitation and Water Resources',
        authorityNote: 'Refuse collection, illegal dumping, and communal sanitation issues are usually municipal implementation matters.',
    },
    Roads: {
        likelyResponsibleAuthority: 'Department of Urban Roads and the municipal assembly works team',
        parliamentaryCommittee: 'Roads and Transport',
        authorityNote: 'Road patching and local road maintenance are typically executed by the urban roads authority and municipal works teams.',
    },
    Drainage: {
        likelyResponsibleAuthority: 'Municipal works department with support from drainage or hydrology authorities',
        parliamentaryCommittee: 'Works and Housing',
        authorityNote: 'Flood channels, drains, and culverts are usually handled by municipal works teams, sometimes with wider drainage support.',
    },
    Education: {
        likelyResponsibleAuthority: 'Ghana Education Service and the local education directorate',
        parliamentaryCommittee: 'Education',
        authorityNote: 'School-facility delivery is usually owned by the education service and local education authorities, not the MP directly.',
    },
    Water: {
        likelyResponsibleAuthority: 'Ghana Water Limited or the municipal assembly for local access issues',
        parliamentaryCommittee: 'Sanitation and Water Resources',
        authorityNote: 'Supply problems and access infrastructure usually sit with the water utility or the local assembly depending on the issue.',
    },
    Security: {
        likelyResponsibleAuthority: 'Ghana Police Service and the local security command structure',
        parliamentaryCommittee: 'Defence and Interior',
        authorityNote: 'The MP can escalate constituent concerns, but operational security response is handled by the security agencies.',
    },
    Other: {
        likelyResponsibleAuthority: 'The relevant municipal assembly, agency, or public utility',
        parliamentaryCommittee: 'Public Accounts or the relevant sector committee',
        authorityNote: 'GovLens treats this as an oversight issue first and makes the implementing authority explicit when the sector is clearer.',
    },
};

export function getGhanaRoutingContext(
    issue: Pick<Issue, 'sector'>,
    constituency = 'Ayawaso West Wuogon'
): GhanaRoutingContext {
    const route = ROUTING_BY_SECTOR[issue.sector] ?? ROUTING_BY_SECTOR.Other;
    return {
        oversightOwner: `MP for ${constituency}`,
        ...route,
    };
}
