// ═══════════════════════════════════════════════════════════════
// GovLens — Mock Data Layer
// Realistic Ghanaian constituency data for Ayawaso West Wuogon
// ═══════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────

export type Status = 'Reported' | 'Acknowledged' | 'In Progress' | 'Escalated' | 'Resolved';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type Sector = 'Infrastructure' | 'Sanitation' | 'Roads' | 'Drainage' | 'Education' | 'Water' | 'Security' | 'Other';
export type PostType = 'Briefing' | 'Notice' | 'Response';

export interface TimelineEvent {
    status: Status;
    date: string;
    note?: string;
}

export interface Comment {
    id: string;
    author: string;
    avatar: string;
    content: string;
    timestamp: string;
    likes: number;
    isMPOffice: boolean;
}

export interface Issue {
    id: string;
    title: string;
    description: string;
    sector: Sector;
    zone: string;
    status: Status;
    severity: Severity;
    reporter: { name: string; avatar: string };
    photos: string[];
    location: { address: string; gps: { lat: number; lng: number } };
    submittedAt: string;
    upvotes: number;
    comments: Comment[];
    affectedResidents: number;
    assignedTo?: string;
    internalNotes?: string;
    timeline: TimelineEvent[];
}

export interface BriefingPost {
    id: string;
    type: PostType;
    title: string;
    body: string;
    sectors: Sector[];
    date: string;
    views: number;
    pinned: boolean;
    author: { name: string; avatar: string };
}

export interface MPProfileData {
    name: string;
    constituency: string;
    party: string;
    term: string;
    approvalRating: number;
    approvalTrend: number;
    approvalHistory: number[];
    sectorResponseRates: Partial<Record<Sector, number>>;
    stats: { issuesFiled: number; resolved: number; avgResponseTime: string };
}

export interface ZoneData {
    id: string;
    name: string;
    issueCount: number;
    resolvedCount: number;
    x: number;
    y: number;
    radius: number;
}

// ── Colour Maps ───────────────────────────────────────────────

export const STATUS_COLORS: Record<Status, string> = {
    'Reported': '#6B6B6B',
    'Acknowledged': '#1E3A8A',
    'In Progress': '#F5A623',
    'Escalated': '#F57C00',
    'Resolved': '#2E7D32',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
    'Low': '#2E7D32',
    'Medium': '#F5A623',
    'High': '#F57C00',
    'Critical': '#C62828',
};

export const SECTOR_COLORS: Record<Sector, string> = {
    'Infrastructure': '#F57C00',
    'Sanitation': '#2E7D32',
    'Roads': '#F5A623',
    'Drainage': '#1E3A8A',
    'Education': '#7C3AED',
    'Water': '#0369A1',
    'Security': '#C62828',
    'Other': '#6B6B6B',
};

export const SECTOR_EMOJIS: Record<Sector, string> = {
    'Infrastructure': '🏗️',
    'Sanitation': '🧹',
    'Roads': '🛣️',
    'Drainage': '🌊',
    'Education': '🎓',
    'Water': '💧',
    'Security': '🔒',
    'Other': '📋',
};

export const POST_TYPE_COLORS: Record<PostType, string> = {
    'Briefing': '#1E3A8A',
    'Notice': '#F5A623',
    'Response': '#2E7D32',
};

export const STATUSES: Status[] = ['Reported', 'Acknowledged', 'In Progress', 'Escalated', 'Resolved'];
export const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
export const SECTORS: Sector[] = ['Infrastructure', 'Sanitation', 'Roads', 'Drainage', 'Education', 'Water', 'Security', 'Other'];
export const ZONES = ['Nima', 'Mamobi', 'Kanda', 'New Town', 'Abelemkpe', 'Dzorwulu'];
export const STAFF = ['Kwame Asante', 'Abena Osei', 'Kofi Mensah', 'Ama Darko'];

// ── Mock Issues ───────────────────────────────────────────────

export const mockIssues: Issue[] = [
    {
        id: 'GL-001',
        title: 'Broken streetlight on Nima Highway',
        description: 'The streetlight on the main Nima Highway near the police barrier has been non-functional for over three weeks. The area becomes extremely dark after 6pm, creating safety concerns for pedestrians, especially women and children returning from the evening market. Several residents have reported near-miss incidents with vehicles.',
        sector: 'Infrastructure',
        zone: 'Nima',
        status: 'In Progress',
        severity: 'High',
        reporter: { name: 'Amina Ibrahim', avatar: 'AI' },
        photos: [],
        location: { address: 'Nima Highway, near Police Barrier', gps: { lat: 5.5780, lng: -0.2050 } },
        submittedAt: '2026-02-10T14:30:00Z',
        upvotes: 47,
        comments: [
            { id: 'c1', author: 'Kwesi Mensah', avatar: 'KM', content: 'This has been an issue for weeks. I nearly got hit by a car last Monday.', timestamp: '2026-02-11T09:15:00Z', likes: 12, isMPOffice: false },
            { id: 'c2', author: 'MP Office', avatar: 'MP', content: 'We have contacted the Electricity Company of Ghana (ECG) and a repair crew has been dispatched. Expected resolution within 5 working days.', timestamp: '2026-02-12T11:00:00Z', likes: 23, isMPOffice: true },
            { id: 'c3', author: 'Fatima Alidu', avatar: 'FA', content: 'Thank you for the update. Please follow up — ECG has a history of delays in this area.', timestamp: '2026-02-12T16:45:00Z', likes: 8, isMPOffice: false },
        ],
        affectedResidents: 2400,
        assignedTo: 'Kwame Asante',
        timeline: [
            { status: 'Reported', date: '2026-02-10T14:30:00Z' },
            { status: 'Acknowledged', date: '2026-02-11T10:00:00Z', note: 'Issue verified by constituency office' },
            { status: 'In Progress', date: '2026-02-12T11:00:00Z', note: 'ECG repair crew dispatched' },
        ],
    },
    {
        id: 'GL-002',
        title: 'Open drain near Mamobi Market',
        description: 'A large open drain adjacent to the Mamobi market entrance has been uncovered for over a month. The concrete slabs that previously covered it have broken and not been replaced. During market hours, the foot traffic around this area is extremely high, and at least two children have fallen in. The drain emits a strong smell and is a breeding ground for mosquitoes.',
        sector: 'Drainage',
        zone: 'Mamobi',
        status: 'Reported',
        severity: 'Critical',
        reporter: { name: 'Abdul-Razak Yusuf', avatar: 'AY' },
        photos: [],
        location: { address: 'Mamobi Market, Main Entrance', gps: { lat: 5.5730, lng: -0.2080 } },
        submittedAt: '2026-02-18T08:20:00Z',
        upvotes: 89,
        comments: [
            { id: 'c4', author: 'Mercy Osei', avatar: 'MO', content: 'My son fell into this drain last week. He had to get a tetanus injection. This is urgent!', timestamp: '2026-02-18T12:30:00Z', likes: 34, isMPOffice: false },
            { id: 'c5', author: 'Issah Adams', avatar: 'IA', content: 'We the market women association have been complaining about this for months. Nothing has been done.', timestamp: '2026-02-19T07:45:00Z', likes: 21, isMPOffice: false },
        ],
        affectedResidents: 5200,
        timeline: [
            { status: 'Reported', date: '2026-02-18T08:20:00Z' },
        ],
    },
    {
        id: 'GL-003',
        title: 'Pothole cluster on Kanda Highway',
        description: 'Multiple deep potholes have formed on the Kanda Highway stretch between the Kanda overpass and the traffic light junction. The largest pothole is approximately 2 feet deep and 4 feet wide. Vehicle damage is being reported daily, and the road is becoming nearly impassable during rush hours as drivers swerve to avoid them.',
        sector: 'Roads',
        zone: 'Kanda',
        status: 'Acknowledged',
        severity: 'Medium',
        reporter: { name: 'Emmanuel Tetteh', avatar: 'ET' },
        photos: [],
        location: { address: 'Kanda Highway, near Overpass', gps: { lat: 5.5845, lng: -0.1920 } },
        submittedAt: '2026-02-05T16:00:00Z',
        upvotes: 63,
        comments: [
            { id: 'c6', author: 'Richard Asiedu', avatar: 'RA', content: 'I have spent GHC 800 on tyre repairs this month alone because of these potholes.', timestamp: '2026-02-06T08:00:00Z', likes: 15, isMPOffice: false },
        ],
        affectedResidents: 3100,
        assignedTo: 'Abena Osei',
        timeline: [
            { status: 'Reported', date: '2026-02-05T16:00:00Z' },
            { status: 'Acknowledged', date: '2026-02-07T09:30:00Z', note: 'Site inspection scheduled' },
        ],
    },
    {
        id: 'GL-004',
        title: 'School roof damage at Nima JHS',
        description: 'The roof of Block C at Nima Junior High School has sustained severe damage from the last rainstorm. Three classrooms are currently unusable as water leaks directly onto desks and the floor becomes dangerously slippery. Over 120 students are affected and have been relocated to the assembly hall, disrupting the entire school schedule.',
        sector: 'Education',
        zone: 'Nima',
        status: 'Escalated',
        severity: 'High',
        reporter: { name: 'Grace Adjei', avatar: 'GA' },
        photos: [],
        location: { address: 'Nima JHS, Block C, Nima', gps: { lat: 5.5760, lng: -0.2065 } },
        submittedAt: '2026-01-28T10:15:00Z',
        upvotes: 112,
        comments: [
            { id: 'c7', author: 'MP Office', avatar: 'MP', content: 'This issue has been escalated to the Ghana Education Service (GES) Metropolitan Directorate. We are pushing for emergency repair funds. The MP has personally visited the school.', timestamp: '2026-02-02T14:00:00Z', likes: 45, isMPOffice: true },
            { id: 'c8', author: 'Daniel Nartey', avatar: 'DN', content: 'Our children cannot learn like this. Thank you for escalating but we need action not words.', timestamp: '2026-02-03T08:20:00Z', likes: 28, isMPOffice: false },
        ],
        affectedResidents: 1800,
        assignedTo: 'Kofi Mensah',
        timeline: [
            { status: 'Reported', date: '2026-01-28T10:15:00Z' },
            { status: 'Acknowledged', date: '2026-01-29T11:00:00Z' },
            { status: 'In Progress', date: '2026-01-31T09:00:00Z', note: 'Assessment team deployed' },
            { status: 'Escalated', date: '2026-02-02T14:00:00Z', note: 'Escalated to GES Metropolitan Directorate' },
        ],
    },
    {
        id: 'GL-005',
        title: 'Irregular water supply in Dzorwulu',
        description: 'Residents of Dzorwulu Residential Area have experienced consistent water supply interruptions over the past two months. Water flows for approximately 3 hours in the early morning (4am–7am) and is completely cut off for the rest of the day. This forces residents to purchase water from tanker services at inflated prices.',
        sector: 'Water',
        zone: 'Dzorwulu',
        status: 'Resolved',
        severity: 'Low',
        reporter: { name: 'Priscilla Owusu', avatar: 'PO' },
        photos: [],
        location: { address: 'Dzorwulu Residential Area', gps: { lat: 5.5950, lng: -0.1980 } },
        submittedAt: '2026-01-15T07:45:00Z',
        upvotes: 34,
        comments: [
            { id: 'c9', author: 'MP Office', avatar: 'MP', content: 'After sustained engagement with the Ghana Water Company Limited (GWCL), the water supply schedule for Dzorwulu has been restored to full capacity. Please report if interruptions resume.', timestamp: '2026-02-08T10:00:00Z', likes: 19, isMPOffice: true },
        ],
        affectedResidents: 950,
        assignedTo: 'Ama Darko',
        timeline: [
            { status: 'Reported', date: '2026-01-15T07:45:00Z' },
            { status: 'Acknowledged', date: '2026-01-16T10:00:00Z' },
            { status: 'In Progress', date: '2026-01-20T09:00:00Z', note: 'GWCL contacted and investigating' },
            { status: 'Resolved', date: '2026-02-08T10:00:00Z', note: 'Water supply restored by GWCL' },
        ],
    },
    {
        id: 'GL-006',
        title: 'Overflowing waste bins in New Town',
        description: 'The communal waste bins along the New Town main road have not been emptied for over two weeks. Refuse is spilling onto the road and surrounding areas. The situation worsens daily and is attracting rats and other vermin. Residents have resorted to burning waste informally, creating a separate air quality hazard.',
        sector: 'Sanitation',
        zone: 'New Town',
        status: 'Reported',
        severity: 'Medium',
        reporter: { name: 'Comfort Agyemang', avatar: 'CA' },
        photos: [],
        location: { address: 'New Town Main Road', gps: { lat: 5.5700, lng: -0.2120 } },
        submittedAt: '2026-02-20T11:30:00Z',
        upvotes: 28,
        comments: [],
        affectedResidents: 1600,
        timeline: [
            { status: 'Reported', date: '2026-02-20T11:30:00Z' },
        ],
    },
    {
        id: 'GL-007',
        title: 'Streetlight outage near Abelemkpe Junction',
        description: 'Four streetlights at the Abelemkpe main junction near the Vodafone tower have been out for over a week. The junction is a key intersection with heavy vehicular and pedestrian traffic. The lack of lighting has already led to two minor accidents at night.',
        sector: 'Infrastructure',
        zone: 'Abelemkpe',
        status: 'In Progress',
        severity: 'Low',
        reporter: { name: 'Samuel Boateng', avatar: 'SB' },
        photos: [],
        location: { address: 'Abelemkpe Junction, near Vodafone Tower', gps: { lat: 5.5890, lng: -0.2010 } },
        submittedAt: '2026-02-14T09:00:00Z',
        upvotes: 15,
        comments: [
            { id: 'c10', author: 'MP Office', avatar: 'MP', content: 'ECG has confirmed the issue is due to a faulty transformer. Repair is scheduled for next week.', timestamp: '2026-02-16T14:30:00Z', likes: 7, isMPOffice: true },
        ],
        affectedResidents: 800,
        assignedTo: 'Kwame Asante',
        timeline: [
            { status: 'Reported', date: '2026-02-14T09:00:00Z' },
            { status: 'Acknowledged', date: '2026-02-15T10:00:00Z' },
            { status: 'In Progress', date: '2026-02-16T14:30:00Z', note: 'ECG transformer repair scheduled' },
        ],
    },
    {
        id: 'GL-008',
        title: 'Flooding on Nima-Mamobi connector road',
        description: 'Persistent flooding on the Nima-Mamobi connector road after every rainfall event. The drainage channels along this road are completely blocked with silt and refuse. Even moderate rain renders the road impassable, cutting off a major commuter route between the two communities.',
        sector: 'Drainage',
        zone: 'Nima',
        status: 'Acknowledged',
        severity: 'Critical',
        reporter: { name: 'Hassan Mustapha', avatar: 'HM' },
        photos: [],
        location: { address: 'Nima-Mamobi Connector Road', gps: { lat: 5.5755, lng: -0.2065 } },
        submittedAt: '2026-02-12T17:00:00Z',
        upvotes: 76,
        comments: [
            { id: 'c11', author: 'Yusuf Bello', avatar: 'YB', content: 'This road floods every single rainy season. We need a permanent solution, not just drain clearing.', timestamp: '2026-02-13T08:00:00Z', likes: 30, isMPOffice: false },
        ],
        affectedResidents: 4500,
        assignedTo: 'Abena Osei',
        timeline: [
            { status: 'Reported', date: '2026-02-12T17:00:00Z' },
            { status: 'Acknowledged', date: '2026-02-14T09:00:00Z', note: 'Hydrological assessment requested' },
        ],
    },
    {
        id: 'GL-009',
        title: 'Security concerns near Mamobi night market',
        description: 'Multiple residents have reported a spike in phone snatching and petty theft incidents around the Mamobi night market area, particularly between 8pm and midnight. The lack of adequate street lighting and police patrol presence is cited as a contributing factor. Market traders are considering closing early.',
        sector: 'Security',
        zone: 'Mamobi',
        status: 'Reported',
        severity: 'High',
        reporter: { name: 'Mariama Iddrisu', avatar: 'MI' },
        photos: [],
        location: { address: 'Mamobi Night Market Area', gps: { lat: 5.5735, lng: -0.2090 } },
        submittedAt: '2026-02-21T20:15:00Z',
        upvotes: 41,
        comments: [
            { id: 'c12', author: 'Abdullah Sani', avatar: 'AS', content: 'My phone was snatched here last Thursday night. The police say they patrol but we never see them.', timestamp: '2026-02-22T06:00:00Z', likes: 18, isMPOffice: false },
        ],
        affectedResidents: 3200,
        timeline: [
            { status: 'Reported', date: '2026-02-21T20:15:00Z' },
        ],
    },
    {
        id: 'GL-010',
        title: 'Cracked barrier wall on Kanda overpass',
        description: 'The concrete barrier wall on the Kanda overpass has developed significant cracks along a 15-metre stretch on the southbound side. Pieces of concrete have been observed falling onto the road below. This is a structural safety hazard that requires immediate engineering assessment.',
        sector: 'Roads',
        zone: 'Kanda',
        status: 'Escalated',
        severity: 'Critical',
        reporter: { name: 'Charles Mensah-Bonsu', avatar: 'CM' },
        photos: [],
        location: { address: 'Kanda Overpass, Southbound', gps: { lat: 5.5850, lng: -0.1915 } },
        submittedAt: '2026-01-22T13:00:00Z',
        upvotes: 95,
        comments: [
            { id: 'c13', author: 'MP Office', avatar: 'MP', content: 'This issue has been escalated to the Department of Urban Roads and the Ghana Highway Authority. An emergency structural assessment is underway. We urge residents to exercise caution on this stretch.', timestamp: '2026-01-25T10:00:00Z', likes: 38, isMPOffice: true },
        ],
        affectedResidents: 6800,
        assignedTo: 'Kofi Mensah',
        timeline: [
            { status: 'Reported', date: '2026-01-22T13:00:00Z' },
            { status: 'Acknowledged', date: '2026-01-23T09:00:00Z' },
            { status: 'Escalated', date: '2026-01-25T10:00:00Z', note: 'Escalated to Dept. of Urban Roads / GHA' },
        ],
    },
    {
        id: 'GL-011',
        title: 'Choked gutter on New Town-Abeka road',
        description: 'The main gutter running along the New Town-Abeka road is severely choked with plastic waste and silt. The blockage spans approximately 200 metres. During the last rainfall, water overflowed into nearby homes, damaging property and furniture. Residents have attempted informal clearing but the scale requires heavy equipment.',
        sector: 'Sanitation',
        zone: 'New Town',
        status: 'In Progress',
        severity: 'Medium',
        reporter: { name: 'Agnes Mensah', avatar: 'AM' },
        photos: [],
        location: { address: 'New Town-Abeka Road', gps: { lat: 5.5710, lng: -0.2140 } },
        submittedAt: '2026-02-01T09:30:00Z',
        upvotes: 31,
        comments: [],
        affectedResidents: 2100,
        assignedTo: 'Ama Darko',
        timeline: [
            { status: 'Reported', date: '2026-02-01T09:30:00Z' },
            { status: 'Acknowledged', date: '2026-02-03T10:00:00Z' },
            { status: 'In Progress', date: '2026-02-06T09:00:00Z', note: 'Zoomlion desilt crew mobilised' },
        ],
    },
    {
        id: 'GL-012',
        title: 'Broken water pipe at Dzorwulu junction',
        description: 'A major water pipe has burst at the Dzorwulu main junction, causing continuous water wastage and flooding of the junction for five days. The water flows across the road surface, creating a slippery hazard for vehicles. GWCL has been notified but no repair team has arrived.',
        sector: 'Water',
        zone: 'Dzorwulu',
        status: 'Acknowledged',
        severity: 'High',
        reporter: { name: 'Nana Yaw Acheampong', avatar: 'NA' },
        photos: [],
        location: { address: 'Dzorwulu Main Junction', gps: { lat: 5.5955, lng: -0.1975 } },
        submittedAt: '2026-02-16T08:00:00Z',
        upvotes: 52,
        comments: [
            { id: 'c14', author: 'Efua Darko', avatar: 'ED', content: 'Clean water running to waste while other parts of Accra do not have water at all. This is unacceptable.', timestamp: '2026-02-17T07:00:00Z', likes: 22, isMPOffice: false },
        ],
        affectedResidents: 1200,
        assignedTo: 'Abena Osei',
        timeline: [
            { status: 'Reported', date: '2026-02-16T08:00:00Z' },
            { status: 'Acknowledged', date: '2026-02-17T11:00:00Z', note: 'GWCL notified and follow-up sent' },
        ],
    },
    {
        id: 'GL-013',
        title: 'School toilet facility needs repair',
        description: 'The toilet facility at Mamobi No. 2 Primary School is in a severe state of disrepair. Four of the six stalls are non-functional. The plumbing is broken, doors are missing, and there is no running water. Over 300 students share the two remaining functional stalls, creating hygiene concerns.',
        sector: 'Education',
        zone: 'Mamobi',
        status: 'Reported',
        severity: 'Medium',
        reporter: { name: 'Rebecca Lartey', avatar: 'RL' },
        photos: [],
        location: { address: 'Mamobi No. 2 Primary School', gps: { lat: 5.5740, lng: -0.2075 } },
        submittedAt: '2026-02-19T12:00:00Z',
        upvotes: 24,
        comments: [],
        affectedResidents: 900,
        timeline: [
            { status: 'Reported', date: '2026-02-19T12:00:00Z' },
        ],
    },
    {
        id: 'GL-014',
        title: 'Road erosion near Abelemkpe residential park',
        description: 'Gradual road erosion has created a 30cm drop-off at the edge of the road near Abelemkpe residential park. The erosion was caused by rainwater runoff and the lack of a proper shoulder drain. The issue was resolved after the Department of Urban Roads patched and reinforced the affected section.',
        sector: 'Roads',
        zone: 'Abelemkpe',
        status: 'Resolved',
        severity: 'Low',
        reporter: { name: 'Francis Addo', avatar: 'FA' },
        photos: [],
        location: { address: 'Near Abelemkpe Residential Park', gps: { lat: 5.5895, lng: -0.2020 } },
        submittedAt: '2026-01-10T14:00:00Z',
        upvotes: 11,
        comments: [],
        affectedResidents: 400,
        assignedTo: 'Kwame Asante',
        timeline: [
            { status: 'Reported', date: '2026-01-10T14:00:00Z' },
            { status: 'Acknowledged', date: '2026-01-12T10:00:00Z' },
            { status: 'In Progress', date: '2026-01-18T09:00:00Z', note: 'Dept. of Urban Roads repair crew deployed' },
            { status: 'Resolved', date: '2026-01-25T16:00:00Z', note: 'Road patched and reinforced' },
        ],
    },
    {
        id: 'GL-015',
        title: 'Illegal dumping site near Nima drain',
        description: 'An illegal refuse dump has formed along the main drain near the Nima lorry station. Despite signage prohibiting dumping, the site continues to accumulate waste. It is now blocking water flow in the drain and contributing to localised flooding during rain.',
        sector: 'Sanitation',
        zone: 'Nima',
        status: 'Reported',
        severity: 'High',
        reporter: { name: 'Mohammed Bawah', avatar: 'MB' },
        photos: [],
        location: { address: 'Near Nima Lorry Station Drain', gps: { lat: 5.5775, lng: -0.2055 } },
        submittedAt: '2026-02-22T07:00:00Z',
        upvotes: 37,
        comments: [],
        affectedResidents: 2800,
        timeline: [
            { status: 'Reported', date: '2026-02-22T07:00:00Z' },
        ],
    },
    {
        id: 'GL-016',
        title: 'Exposed streetlight wiring at New Town junction',
        description: 'Electrical wiring from a damaged streetlight pole at the New Town main junction is hanging exposed at a height reachable by children. The insulation is stripped in several places. This presents an immediate electrocution risk, particularly during the rainy season.',
        sector: 'Infrastructure',
        zone: 'New Town',
        status: 'Acknowledged',
        severity: 'Critical',
        reporter: { name: 'Vida Ocansey', avatar: 'VO' },
        photos: [],
        location: { address: 'New Town Main Junction', gps: { lat: 5.5705, lng: -0.2130 } },
        submittedAt: '2026-02-17T15:00:00Z',
        upvotes: 68,
        comments: [
            { id: 'c15', author: 'MP Office', avatar: 'MP', content: 'Emergency request sent to ECG. In the interim, we have arranged for the area to be cordoned off with warning tape.', timestamp: '2026-02-18T08:00:00Z', likes: 31, isMPOffice: true },
        ],
        affectedResidents: 3500,
        assignedTo: 'Kofi Mensah',
        timeline: [
            { status: 'Reported', date: '2026-02-17T15:00:00Z' },
            { status: 'Acknowledged', date: '2026-02-18T08:00:00Z', note: 'Area cordoned, emergency request to ECG' },
        ],
    },
    {
        id: 'GL-017',
        title: 'Drainage blockage causing street flooding on Ring Road',
        description: 'Blocked drainage culverts on the Kanda section of the Ring Road are causing street-level flooding during any rainfall. The standing water persists for hours after rain stops, creating mosquito breeding conditions and traffic congestion.',
        sector: 'Drainage',
        zone: 'Kanda',
        status: 'In Progress',
        severity: 'High',
        reporter: { name: 'Akosua Poku', avatar: 'AP' },
        photos: [],
        location: { address: 'Ring Road, Kanda Section', gps: { lat: 5.5840, lng: -0.1930 } },
        submittedAt: '2026-02-08T10:00:00Z',
        upvotes: 44,
        comments: [],
        affectedResidents: 3800,
        assignedTo: 'Abena Osei',
        timeline: [
            { status: 'Reported', date: '2026-02-08T10:00:00Z' },
            { status: 'Acknowledged', date: '2026-02-09T10:00:00Z' },
            { status: 'In Progress', date: '2026-02-11T09:00:00Z', note: 'Culvert clearing operation in progress' },
        ],
    },
    {
        id: 'GL-018',
        title: 'Inadequate security lighting at Dzorwulu Community Park',
        description: 'The Dzorwulu Community Park, used by residents for evening exercise and recreation, has zero functional lighting. The park closes informally at dusk because it becomes unsafe. Residents have requested solar-powered lights as a sustainable solution.',
        sector: 'Security',
        zone: 'Dzorwulu',
        status: 'Reported',
        severity: 'Medium',
        reporter: { name: 'Adjoa Sarpong', avatar: 'AS' },
        photos: [],
        location: { address: 'Dzorwulu Community Park', gps: { lat: 5.5960, lng: -0.1990 } },
        submittedAt: '2026-02-23T08:00:00Z',
        upvotes: 19,
        comments: [],
        affectedResidents: 600,
        timeline: [
            { status: 'Reported', date: '2026-02-23T08:00:00Z' },
        ],
    },
];

// ── Mock Briefings ────────────────────────────────────────────

export const mockBriefings: BriefingPost[] = [
    {
        id: 'B-001',
        type: 'Briefing',
        title: 'Monthly Constituency Development Report — January 2026',
        body: 'This report covers the key developments and ongoing projects within the Ayawaso West Wuogon constituency for January 2026.\n\nRoad Infrastructure: The Kanda Highway resurfacing project (Phase 1) is 65% complete. The contractor has committed to completion by the end of March 2026. The Abelemkpe inner roads rehabilitation has been awarded and will commence in February.\n\nWater & Sanitation: Following persistent complaints about water supply interruptions in Dzorwulu, the MP office engaged the Ghana Water Company Limited (GWCL) directly. A new supply schedule has been implemented and is being monitored. Three new communal waste collection points have been established in Nima and Mamobi.\n\nEducation: The constituency has secured funding for roof repairs at Nima JHS and toilet facility rehabilitation at Mamobi No. 2 Primary. These projects are expected to begin in Q1 2026.\n\nSecurity: In collaboration with the Ghana Police Service (Nima Division), the MP office has sponsored the installation of 12 CCTV cameras at key junctions across Nima, Mamobi, and New Town. Installation is expected to be completed by April 2026.\n\nThe MP will hold a constituency town hall meeting on February 15, 2026 at the Nima Community Centre to discuss these and other pressing matters. All residents are encouraged to attend.',
        sectors: ['Roads', 'Water', 'Education', 'Security'],
        date: '2026-02-01T09:00:00Z',
        views: 1247,
        pinned: true,
        author: { name: 'Hon. John Dumelo', avatar: 'JD' },
    },
    {
        id: 'B-002',
        type: 'Notice',
        title: 'Road Resurfacing Schedule — Kanda Highway',
        body: 'The Department of Urban Roads has communicated the following schedule for the Kanda Highway resurfacing project:\n\nPhase 2 (Kanda Overpass to Traffic Light Junction): February 10–28, 2026\nPhase 3 (Traffic Light Junction to Nima Highway): March 1–20, 2026\n\nDuring construction, traffic will be diverted through the Kanda residential inner roads. Signage will be placed at all diversion points. Residents are advised to allow an additional 20 minutes for commutes during this period.\n\nFor complaints or damage claims related to the construction, contact the constituency office at 020-XXX-XXXX.',
        sectors: ['Roads'],
        date: '2026-02-08T12:00:00Z',
        views: 834,
        pinned: false,
        author: { name: 'Hon. Lydia Alhassan', avatar: 'LA' },
    },
    {
        id: 'B-003',
        type: 'Response',
        title: 'Response to Drainage and Flooding Complaints',
        body: 'The MP office has received a significant volume of reports regarding drainage blockages and flooding, particularly in Nima, Mamobi, and Kanda.\n\nWe want to assure constituents that every report is logged and tracked. Here is a summary of our response:\n\n1. Nima-Mamobi connector road: A hydrological assessment has been commissioned. The goal is not just to clear the drains but to determine why the drainage infrastructure is insufficient for the area\'s needs.\n\n2. Kanda Ring Road culverts: Clearing operations are underway with Zoomlion. Expected completion: February 20.\n\n3. Long-term planning: The MP has written to the Ministry of Works and Housing requesting that the Nima-Mamobi drainage corridor be included in the 2026–2027 capital works programme.\n\nWe understand the frustration. Flooding is a recurring crisis that cannot be solved by drain-clearing alone. We are pushing for structural investment.',
        sectors: ['Drainage', 'Sanitation'],
        date: '2026-02-15T10:00:00Z',
        views: 623,
        pinned: false,
        author: { name: 'Hon. Lydia Alhassan', avatar: 'LA' },
    },
    {
        id: 'B-004',
        type: 'Notice',
        title: 'Community Town Hall Meeting — February 2026',
        body: 'The MP for Ayawaso West Wuogon invites all residents to the monthly constituency town hall meeting.\n\nDate: Saturday, 15th February 2026\nTime: 10:00 AM – 1:00 PM\nVenue: Nima Community Centre, Main Hall\n\nAgenda:\n• Progress update on ongoing infrastructure projects\n• Presentation of the 2026 constituency development plan\n• Q&A session with the MP and constituency office staff\n• Introduction of the new GovLens civic platform\n\nLight refreshments will be provided. Translation services will be available in Hausa and Ga.\n\nFor questions, contact the constituency office.',
        sectors: ['Other'],
        date: '2026-02-10T08:00:00Z',
        views: 456,
        pinned: false,
        author: { name: 'Hon. Lydia Alhassan', avatar: 'LA' },
    },
    {
        id: 'B-005',
        type: 'Briefing',
        title: 'Water Infrastructure Progress and GWCL Engagement',
        body: 'Following the resolution of the Dzorwulu water supply interruption (Issue GL-005), the MP office has been in continued dialogue with GWCL on broader water infrastructure needs.\n\nKey outcomes:\n• GWCL has agreed to prioritise the replacement of the aging main pipeline along the Abelemkpe-Dzorwulu corridor. A project timeline is expected by March 2026.\n• A community water quality testing programme will launch in Nima and Mamobi in partnership with CSIR-WRI (Water Research Institute). Results will be shared publicly.\n• The burst pipe at Dzorwulu Junction (Issue GL-012) has been flagged for emergency repair — follow progress on the issue tracker.\n\nWater is a fundamental right. We will continue to hold GWCL accountable for service delivery in our constituency.',
        sectors: ['Water'],
        date: '2026-02-20T14:00:00Z',
        views: 312,
        pinned: false,
        author: { name: 'Hon. Lydia Alhassan', avatar: 'LA' },
    },
];

// ── Mock MP Profile ───────────────────────────────────────────

export const mockMPProfile: MPProfileData = {
    name: 'Hon. John Dumelo',
    constituency: 'Ayawaso West Wuogon',
    party: 'National Democratic Congress (NDC)',
    term: '2025 – 2029',
    approvalRating: 72,
    approvalTrend: 6,
    approvalHistory: [58, 62, 65, 68, 66, 72],
    sectorResponseRates: {
        'Infrastructure': 85,
        'Sanitation': 71,
        'Roads': 78,
        'Drainage': 64,
        'Education': 90,
        'Water': 82,
        'Security': 55,
    },
    stats: {
        issuesFiled: 168,
        resolved: 94,
        avgResponseTime: '3.2 days',
    },
};

// ── Mock Zones ────────────────────────────────────────────────

export const mockZones: ZoneData[] = [
    { id: 'nima', name: 'Nima', issueCount: 72, resolvedCount: 28, x: 200, y: 180, radius: 65 },
    { id: 'mamobi', name: 'Mamobi', issueCount: 58, resolvedCount: 20, x: 340, y: 220, radius: 55 },
    { id: 'kanda', name: 'Kanda', issueCount: 45, resolvedCount: 22, x: 450, y: 140, radius: 48 },
    { id: 'new-town', name: 'New Town', issueCount: 38, resolvedCount: 18, x: 150, y: 320, radius: 42 },
    { id: 'abelemkpe', name: 'Abelemkpe', issueCount: 22, resolvedCount: 15, x: 380, y: 350, radius: 35 },
    { id: 'dzorwulu', name: 'Dzorwulu', issueCount: 18, resolvedCount: 12, x: 500, y: 300, radius: 30 },
];

// ── Utility Helpers ───────────────────────────────────────────

export function getZoneSeverity(issueCount: number): Severity {
    if (issueCount >= 70) return 'Critical';
    if (issueCount >= 50) return 'High';
    if (issueCount >= 35) return 'Medium';
    return 'Low';
}

export function getTimeAgo(dateStr: string): string {
    const now = new Date('2026-02-24T02:00:00Z');
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
