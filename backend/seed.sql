-- =============================================================================
-- GovLens MVP — Seed Data (Ghanaian — Ayawaso West Wuogon Constituency, Accra)
-- Run via Docker: docker compose exec postgres psql -U govlens -d govlens -f /seed.sql
-- =============================================================================

-- ── 1. Users ──────────────────────────────────────────────────────────────────
-- Passwords are all "password123" hashed with bcrypt cost 10.
INSERT INTO users (id, name, email, password_hash, role, constituency) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Amina Ibrahim',     'amina@example.com',  '$2a$10$7IwOXAxRX3l.Qm2Su6x19O5LuRpz/BDiVjSTzAFZAmGuNlyoZC0Ze', 'citizen', 'Ayawaso West Wuogon'),
  ('00000000-0000-0000-0000-000000000002', 'Abdul-Razak Yusuf', 'razak@example.com',  '$2a$10$7IwOXAxRX3l.Qm2Su6x19O5LuRpz/BDiVjSTzAFZAmGuNlyoZC0Ze', 'citizen', 'Ayawaso West Wuogon'),
  ('00000000-0000-0000-0000-000000000003', 'Emmanuel Tetteh',   'emmanuel@example.com','$2a$10$7IwOXAxRX3l.Qm2Su6x19O5LuRpz/BDiVjSTzAFZAmGuNlyoZC0Ze', 'citizen', 'Ayawaso West Wuogon'),
  ('00000000-0000-0000-0000-000000000004', 'Hon. John Dumelo',   'mp@example.com',     '$2a$10$7IwOXAxRX3l.Qm2Su6x19O5LuRpz/BDiVjSTzAFZAmGuNlyoZC0Ze', 'mp',      'Ayawaso West Wuogon'),
  ('00000000-0000-0000-0000-000000000005', 'System Admin',      'admin@example.com',  '$2a$10$7IwOXAxRX3l.Qm2Su6x19O5LuRpz/BDiVjSTzAFZAmGuNlyoZC0Ze', 'admin',   NULL)
ON CONFLICT (email) DO NOTHING;

-- ── 1.1 MP Profile ───────────────────────────────────────────────────────────
INSERT INTO mp_profiles (user_id, party, term_start, term_end, bio, phone, office_addr, photo_url) VALUES
  (
    '00000000-0000-0000-0000-000000000004',
    'National Democratic Congress (NDC)',
    '2025',
    '2029',
    'Hon. John Dumelo is the Member of Parliament for Ayawaso West Wuogon Constituency in the Greater Accra Region. A film actor, entrepreneur and agripreneur, he champions youth employment, community development, and transparent governance for constituents.',
    '+233 030 000 0004',
    'Ayawaso West Wuogon Constituency Office, East Legon, Accra',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVsUNgf_koOZU7DOnFrttBzXePTeJUJC2_-Q&s'
  )
ON CONFLICT (user_id) DO UPDATE SET
  party       = EXCLUDED.party,
  term_start  = EXCLUDED.term_start,
  term_end    = EXCLUDED.term_end,
  bio         = EXCLUDED.bio,
  phone       = EXCLUDED.phone,
  office_addr = EXCLUDED.office_addr,
  updated_at  = NOW();


-- ── 2. Issues ─────────────────────────────────────────────────────────────────
INSERT INTO issues (id, user_id, title, description, status, sector, severity, zone, lat, lng, upvotes, created_at, updated_at) VALUES

  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Broken streetlight on East Legon main road',
   'The streetlight on the East Legon main road near the A&C Mall junction has been non-functional for over three weeks. The area becomes extremely dark after 6pm, creating safety concerns for pedestrians and motorists. Several residents have reported near-miss incidents with vehicles at the unlit intersection.',
   'in-progress', 'infrastructure', 'high', 'East Legon', 5.6350, -0.1585, 47,
   NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days'),

  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002',
   'Open drain near Okponglo junction',
   'A large open drain adjacent to the Okponglo junction has been uncovered for over a month. The concrete slabs that previously covered it have broken and not been replaced. During peak hours, foot traffic is extremely high, and at least two children have fallen in. The drain emits a strong smell and is a breeding ground for mosquitoes.',
   'open', 'drainage', 'critical', 'Okponglo', 5.6270, -0.1905, 89,
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

  ('10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000003',
   'Pothole cluster on Roman Ridge road',
   'Multiple deep potholes have formed on the Roman Ridge road stretch near the Ridge Church junction. The largest pothole is approximately 2 feet deep and 4 feet wide. Vehicle damage is being reported daily, and the road is becoming nearly impassable during rush hours as drivers swerve to avoid them.',
   'open', 'roads', 'medium', 'Roman Ridge', 5.6035, -0.1990, 63,
   NOW() - INTERVAL '23 days', NOW() - INTERVAL '21 days'),

  ('10000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'School roof damage at East Legon Presby Basic',
   'The roof of Block C at East Legon Presbyterian Basic School has sustained severe damage from the last rainstorm. Three classrooms are currently unusable as water leaks directly onto desks. Over 120 students are affected and have been relocated to the assembly hall, disrupting the entire school schedule.',
   'in-progress', 'education', 'high', 'East Legon', 5.6395, -0.1640, 112,
   NOW() - INTERVAL '31 days', NOW() - INTERVAL '27 days'),

  ('10000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000003',
   'Irregular water supply in Dzorwulu',
   'Residents of Dzorwulu Residential Area have experienced consistent water supply interruptions over the past two months. Water flows for approximately 3 hours in the early morning (4am–7am) and is completely cut off for the rest of the day. This forces residents to purchase water from tanker services at inflated prices.',
   'resolved', 'water', 'low', 'Dzorwulu', 5.5950, -0.1980, 34,
   NOW() - INTERVAL '44 days', NOW() - INTERVAL '20 days'),

  ('10000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000002',
   'Overflowing waste bins on Airport Residential road',
   'The communal waste bins along the Airport Residential main road have not been emptied for over two weeks. Refuse is spilling onto the road and surrounding areas. The situation worsens daily and is attracting rats and other vermin. Residents have resorted to burning waste informally, creating a separate air quality hazard.',
   'open', 'sanitation', 'medium', 'Airport Residential', 5.6050, -0.1820, 28,
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),

  ('10000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000003',
   'Streetlight outage near Abelemkpe Junction',
   'Four streetlights at the Abelemkpe main junction near the Vodafone tower have been out for over a week. The junction is a key intersection with heavy vehicular and pedestrian traffic. The lack of lighting has already led to two minor accidents at night.',
   'in-progress', 'infrastructure', 'low', 'Abelemkpe', 5.5890, -0.2010, 15,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),

  ('10000000-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000001',
   'Flooding on East Legon-Shiashie connector road',
   'Persistent flooding on the East Legon-Shiashie connector road after every rainfall event. The drainage channels along this road are completely blocked with silt and refuse. Even moderate rain renders the road impassable, cutting off a major commuter route between the two communities.',
   'open', 'drainage', 'critical', 'East Legon', 5.6365, -0.1625, 76,
   NOW() - INTERVAL '16 days', NOW() - INTERVAL '14 days'),

  ('10000000-0000-0000-0000-000000000009',
   '00000000-0000-0000-0000-000000000002',
   'Security concerns near Okponglo night market',
   'Multiple residents have reported a spike in phone snatching and petty theft incidents around the Okponglo night market area, particularly between 8pm and midnight. The lack of adequate street lighting and police patrol presence is cited as a contributing factor. Market traders are considering closing early for safety.',
   'open', 'security', 'high', 'Okponglo', 5.6290, -0.1935, 41,
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),

  ('10000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000003',
   'Cracked barrier wall on Roman Ridge overpass',
   'The concrete barrier wall on the Roman Ridge overpass has developed significant cracks along a 15-metre stretch on the southbound side. Pieces of concrete have been observed falling onto the road below. This is a structural safety hazard that requires immediate engineering assessment and temporary barricading.',
   'in-progress', 'roads', 'critical', 'Roman Ridge', 5.6020, -0.2015, 95,
   NOW() - INTERVAL '37 days', NOW() - INTERVAL '33 days'),

  ('10000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'Choked gutter on Airport Residential-Cantonments road',
   'The main gutter running along the Airport Residential-Cantonments road is severely choked with plastic waste and silt. The blockage spans approximately 200 metres. During the last rainfall, water overflowed into nearby homes, damaging property and furniture.',
   'in-progress', 'sanitation', 'medium', 'Airport Residential', 5.6075, -0.1850, 31,
   NOW() - INTERVAL '27 days', NOW() - INTERVAL '22 days'),

  ('10000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000002',
   'Broken water pipe at Dzorwulu junction',
   'A major water pipe has burst at the Dzorwulu main junction, causing continuous water wastage and flooding of the junction for five days. The water flows across the road surface, creating a slippery hazard for vehicles. GWCL has been notified but no repair team has arrived.',
   'open', 'water', 'high', 'Dzorwulu', 5.5955, -0.1975, 52,
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days'),

  ('10000000-0000-0000-0000-000000000013',
   '00000000-0000-0000-0000-000000000003',
   'School toilet facility in disrepair — Okponglo No. 2 Primary',
   'The toilet facility at Okponglo No. 2 Primary School is in a severe state of disrepair. Four of the six stalls are non-functional. The plumbing is broken, doors are missing, and there is no running water. Over 300 students share the two remaining functional stalls, creating serious hygiene concerns.',
   'open', 'education', 'medium', 'Okponglo', 5.6260, -0.1910, 24,
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),

  ('10000000-0000-0000-0000-000000000014',
   '00000000-0000-0000-0000-000000000001',
   'Road erosion near Abelemkpe residential park',
   'Gradual road erosion had created a 30cm drop-off at the edge of the road near Abelemkpe residential park. The erosion was caused by rainwater runoff and the lack of a proper shoulder drain. Issue resolved after the Department of Urban Roads patched and reinforced the affected section.',
   'resolved', 'roads', 'low', 'Abelemkpe', 5.5895, -0.2020, 11,
   NOW() - INTERVAL '79 days', NOW() - INTERVAL '60 days'),

  ('10000000-0000-0000-0000-000000000015',
   '00000000-0000-0000-0000-000000000002',
   'Unauthorised kiosk obstruction on Airport Residential pavement',
   'Several unauthorised wooden kiosks have been erected on the pavement along the Airport Residential main road near the traffic light. These kiosks completely block the pavement, forcing pedestrians — including schoolchildren and the elderly — onto the road. AMA enforcement has been notified.',
   'open', 'sanitation', 'medium', 'Airport Residential', 5.6060, -0.1835, 19,
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days')

ON CONFLICT (id) DO NOTHING;

-- ── 3. Comments ───────────────────────────────────────────────────────────────
INSERT INTO comments (issue_id, user_id, content, created_at) VALUES

  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'I can confirm this. Narrowly avoided a collision near the junction on Tuesday night. ECG must act now.',
   NOW() - INTERVAL '17 days'),

  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004',
   'We have contacted the Electricity Company of Ghana (ECG) and a repair crew has been dispatched. Expected resolution within 5 working days.',
   NOW() - INTERVAL '16 days'),

  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   'My daughter fell into this drain last week and needed a tetanus injection. This is a health emergency — please escalate.',
   NOW() - INTERVAL '9 days'),

  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'The market women association has been raising this for months. Nothing happens. We need more than acknowledgment.',
   NOW() - INTERVAL '9 days'),

  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'I have spent GHC 800 on tyre repairs this month alone because of these potholes. The Department of Urban Roads must be held accountable.',
   NOW() - INTERVAL '22 days'),

  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004',
   'This has been escalated to the Ghana Education Service Metropolitan Directorate. We are pushing for emergency repair funds. The MP has personally visited the school.',
   NOW() - INTERVAL '27 days'),

  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002',
   'Our children cannot learn like this. Thank you for escalating but we need action, not words. Every day of rain is another day lost.',
   NOW() - INTERVAL '26 days'),

  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004',
   'After sustained engagement with the Ghana Water Company Limited (GWCL), the water supply schedule for Dzorwulu has been restored to full capacity. Please report if interruptions resume.',
   NOW() - INTERVAL '20 days'),

  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004',
   'ECG has confirmed the issue is due to a faulty transformer. Repair is scheduled for next week. Thank you for your patience.',
   NOW() - INTERVAL '12 days'),

  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003',
   'This road floods every single rainy season without fail. We need a permanent drainage solution, not just seasonal drain clearing.',
   NOW() - INTERVAL '14 days'),

  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003',
   'My phone was snatched here last Thursday night. The police claim they patrol but we never see them. We need visible presence.',
   NOW() - INTERVAL '6 days'),

  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004',
   'This issue has been escalated to the Department of Urban Roads and the Ghana Highway Authority. An emergency structural assessment is underway. Please exercise caution on this stretch.',
   NOW() - INTERVAL '33 days'),

  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'Clean water running to waste while other parts of Accra have none at all. GWCL must respond immediately — this is unacceptable.',
   NOW() - INTERVAL '11 days')

ON CONFLICT DO NOTHING;

-- ── 4. Briefings ──────────────────────────────────────────────────────────────
INSERT INTO briefings (mp_id, title, content, zone, published_at) VALUES

  ('00000000-0000-0000-0000-000000000004',
   'Infrastructure Update — Ayawaso West Wuogon Q1 2026',
   'Dear residents of Ayawaso West Wuogon, I am pleased to report that the Department of Urban Roads has approved budget for resurfacing 6km of roads across our constituency, including Roman Ridge road and the East Legon-Shiashie connector. Work commences in April 2026. We have also submitted a request to ECG for 60 new solar-powered LED streetlights along high-traffic corridors.',
   'East Legon', NOW() - INTERVAL '3 days'),

  ('00000000-0000-0000-0000-000000000004',
   'Update on Drainage Rehabilitation Works',
   'Following the flooding reports received from Okponglo and East Legon communities, I have engaged the Accra Metropolitan Assembly (AMA) to prioritise the desilting of major drains in our constituency. Zoomlion Ghana Limited has been contracted and work will begin within 2 weeks. I call on all residents to avoid dumping refuse into gutters.',
   'Okponglo', NOW() - INTERVAL '10 days'),

  ('00000000-0000-0000-0000-000000000004',
   'School Improvement Programme — GES Partnership',
   'My office has signed a partnership with the Ghana Education Service Metropolitan Directorate to rehabilitate school infrastructure across Ayawaso West Wuogon. Two schools are prioritised in Phase 1: East Legon Presbyterian Basic School (roof repair) and Okponglo No. 2 Primary School (sanitation block). Construction begins May 2026.',
   'East Legon', NOW() - INTERVAL '20 days'),

  ('00000000-0000-0000-0000-000000000004',
   'Community Safety Dialogue — Okponglo Night Market',
   'In response to security concerns raised by residents around the Okponglo night market area, I have convened a stakeholder meeting with the Ghana Police Service, the AMA, and market leaders. We have agreed to deploy 4 additional patrol officers on evening shifts and to fast-track installation of 8 solar streetlights at the market perimeter.',
   'Okponglo', NOW() - INTERVAL '5 days')

ON CONFLICT DO NOTHING;

-- ── 5. Upvotes (link users to issues they have upvoted) ───────────────────────
INSERT INTO issue_upvotes (issue_id, user_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;
