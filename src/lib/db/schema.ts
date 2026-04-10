import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  jsonb,
  unique,
  bigint,
  uuid,
  numeric,
  real,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom pgvector type for embedding storage
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverParam: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]) {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: unknown) {
      const str = String(value);
      return str.slice(1, -1).split(',').map(Number);
    },
  })(name);

// ──────────────────────────────────────
// Political Groups (canonical cross-term identities)
// ──────────────────────────────────────

export const politicalGroups = pgTable('political_groups', {
  id: serial('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  canonicalName: text('canonical_name').notNull(),
  shortName: text('short_name'),
  color: text('color'),
  logoUrl: text('logo_url'),
  foundedYear: integer('founded_year'),
  dissolvedYear: integer('dissolved_year'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const politicalGroupLineage = pgTable(
  'political_group_lineage',
  {
    id: serial('id').primaryKey(),
    sourceGroupId: integer('source_group_id')
      .references(() => politicalGroups.id, { onDelete: 'cascade' })
      .notNull(),
    targetGroupId: integer('target_group_id')
      .references(() => politicalGroups.id, { onDelete: 'cascade' })
      .notNull(),
    relationshipType: text('relationship_type').notNull(), // 'merged_into' | 'split_from' | 'renamed_to' | 'absorbed_by'
    knessetNum: integer('knesset_num'),
    year: integer('year'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.sourceGroupId, t.targetGroupId, t.relationshipType)],
);

// ──────────────────────────────────────
// Core Tables
// ──────────────────────────────────────

export const factions = pgTable('factions', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  name: text('name').notNull(),
  knessetNum: integer('knesset_num'),
  isCoalition: boolean('is_coalition').default(false),
  seats: integer('seats'),
  color: text('color'),
  logoUrl: text('logo_url'),
  startDate: date('start_date'),
  finishDate: date('finish_date'),
  isCurrent: boolean('is_current').default(false),
  politicalGroupId: integer('political_group_id').references(
    () => politicalGroups.id,
  ),
  electoralListId: integer('electoral_list_id').references(
    () => electoralLists.id,
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  vipId: integer('vip_id'),
  legacyVipId: integer('legacy_vip_id'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  factionId: integer('faction_id').references(() => factions.id),
  isCurrent: boolean('is_current').default(false),
  gender: text('gender'),
  birthDate: date('birth_date'),
  imageUrl: text('image_url'),
  imageSource: text('image_source'), // 'oknesset' | 'wikidata' | 'knesset_official' | 'manual'
  imageAttribution: text('image_attribution'),
  email: text('email'),
  phone: text('phone'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  knessetNum: integer('knesset_num'),
  isCoalition: boolean('is_coalition'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────
// Political Entities
// ──────────────────────────────────────

export const politicalParties = pgTable('political_parties', {
  id: serial('id').primaryKey(),
  registrarNumber: text('registrar_number').unique().notNull(),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  type: text('type').notNull().default('party'), // 'party' | 'movement'
  registrationYear: integer('registration_year'),
  phone: text('phone'),
  fax: text('fax'),
  email: text('email'),
  address: text('address'),
  goals: text('goals'),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const electoralLists = pgTable(
  'electoral_lists',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    ballotLetters: text('ballot_letters').notNull(),
    knessetNum: integer('knesset_num').notNull(),
    totalVotes: integer('total_votes'),
    votePercentage: numeric('vote_percentage', {
      precision: 5,
      scale: 2,
    }),
    seats: integer('seats').notNull().default(0),
    isElected: boolean('is_elected').notNull().default(false),
    electionDate: date('election_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.ballotLetters, t.knessetNum)],
);

export const partyFinancialReports = pgTable(
  'party_financial_reports',
  {
    id: serial('id').primaryKey(),
    partyId: integer('party_id')
      .references(() => politicalParties.id, { onDelete: 'cascade' })
      .notNull(),
    year: integer('year').notNull(),
    reportType: text('report_type').notNull(), // 'financial' | 'assets'
    pdfUrl: text('pdf_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.partyId, t.year, t.reportType)],
);

export const electoralListParties = pgTable(
  'electoral_list_parties',
  {
    id: serial('id').primaryKey(),
    electoralListId: integer('electoral_list_id')
      .references(() => electoralLists.id, { onDelete: 'cascade' })
      .notNull(),
    partyId: integer('party_id')
      .references(() => politicalParties.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [unique().on(t.electoralListId, t.partyId)],
);

export const partyFactionLinks = pgTable(
  'party_faction_links',
  {
    id: serial('id').primaryKey(),
    partyId: integer('party_id')
      .references(() => politicalParties.id, { onDelete: 'cascade' })
      .notNull(),
    factionId: integer('faction_id')
      .references(() => factions.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [unique().on(t.partyId, t.factionId)],
);

export const factionCompositionHistory = pgTable(
  'faction_composition_history',
  {
    id: serial('id').primaryKey(),
    factionId: integer('faction_id')
      .references(() => factions.id, { onDelete: 'cascade' })
      .notNull(),
    partyId: integer('party_id')
      .references(() => politicalParties.id, { onDelete: 'cascade' })
      .notNull(),
    knessetNum: integer('knesset_num').notNull(),
    role: text('role').notNull().default('partner'), // 'sole' | 'primary' | 'partner' | 'junior'
    joinDate: date('join_date'),
    leaveDate: date('leave_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.factionId, t.partyId, t.knessetNum)],
);

export const factionCoalitionPeriods = pgTable(
  'faction_coalition_periods',
  {
    id: serial('id').primaryKey(),
    factionId: integer('faction_id')
      .references(() => factions.id, { onDelete: 'cascade' })
      .notNull(),
    knessetNum: integer('knesset_num').notNull(),
    governmentNum: integer('government_num').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.factionId, t.knessetNum, t.governmentNum)],
);

// ──────────────────────────────────────
// Government Tables
// ──────────────────────────────────────

export const govMinistries = pgTable('gov_ministries', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(), // KNS_GovMinistry.GovMinistryID
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const governments = pgTable('governments', {
  id: serial('id').primaryKey(),
  governmentNum: integer('government_num').unique().notNull(),
  knessetNum: integer('knesset_num').notNull(),
  name: text('name').notNull(), // "הממשלה ה-37"
  startDate: date('start_date'),
  endDate: date('end_date'),
  pmMemberId: integer('pm_member_id').references(() => members.id),
  alternatePmMemberId: integer('alternate_pm_member_id').references(
    () => members.id,
  ),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const governmentPositions = pgTable(
  'government_positions',
  {
    id: serial('id').primaryKey(),
    governmentId: integer('government_id')
      .references(() => governments.id, { onDelete: 'cascade' })
      .notNull(),
    memberId: integer('member_id').references(() => members.id), // nullable for historical
    memberKnessetId: integer('member_knesset_id').notNull(), // PersonID from OData
    positionId: integer('position_id').notNull(), // PositionID from OData
    positionDesc: text('position_desc'), // Denormalized position name
    govMinistryId: integer('gov_ministry_id').references(
      () => govMinistries.id,
    ),
    factionKnessetId: integer('faction_knesset_id'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(
      t.governmentId,
      t.memberKnessetId,
      t.positionId,
      t.govMinistryId,
      t.startDate,
    ),
  ],
);

export const memberFactionHistory = pgTable(
  'member_faction_history',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .references(() => members.id, { onDelete: 'cascade' })
      .notNull(),
    factionId: integer('faction_id')
      .references(() => factions.id, { onDelete: 'cascade' })
      .notNull(),
    knessetNum: integer('knesset_num').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
  },
  (t) => [unique().on(t.memberId, t.factionId, t.startDate)],
);

export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  name: text('name').notNull(),
  summary: text('summary'),
  status: text('status'),
  billType: text('bill_type'),
  subTypeId: integer('sub_type_id'),
  isContinuationBill: boolean('is_continuation_bill'),
  committeeId: integer('committee_id'),
  knessetNum: integer('knesset_num'),
  proposedDate: date('proposed_date'),
  lastUpdate: timestamp('last_update', { withTimezone: true }),
  category: text('category'),
  fullTextUrl: text('full_text_url'),
  aiSummary: jsonb('ai_summary').$type<Record<string, string>>(),
  aiTopics: jsonb('ai_topics').$type<Record<string, string[]>>(),
  metadata: jsonb('metadata'),
  clusterId: integer('cluster_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const votes = pgTable('votes', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  title: text('title').notNull(),
  voteDate: timestamp('vote_date', { withTimezone: true }).notNull(),
  voteType: text('vote_type'),
  knessetNum: integer('knesset_num'),
  sessionId: integer('session_id'),
  sessItemId: integer('sess_item_id'),
  billId: integer('bill_id').references(() => bills.id),
  forCount: integer('for_count').default(0),
  againstCount: integer('against_count').default(0),
  abstainCount: integer('abstain_count').default(0),
  isAccepted: boolean('is_accepted'),
  summary: text('summary'),
  metadata: jsonb('metadata'),
  billStage: integer('bill_stage'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const memberVotes = pgTable(
  'member_votes',
  {
    id: serial('id').primaryKey(),
    voteId: integer('vote_id')
      .references(() => votes.id)
      .notNull(),
    memberId: integer('member_id')
      .references(() => members.id)
      .notNull(),
    voteValue: text('vote_value').notNull(), // 'for', 'against', 'abstain', 'absent'
  },
  (t) => [unique().on(t.voteId, t.memberId)],
);

export const billInitiators = pgTable(
  'bill_initiators',
  {
    id: serial('id').primaryKey(),
    billId: integer('bill_id')
      .references(() => bills.id)
      .notNull(),
    memberId: integer('member_id')
      .references(() => members.id)
      .notNull(),
    isPrimary: boolean('is_primary').default(false),
  },
  (t) => [unique().on(t.billId, t.memberId)],
);

export const billUnions = pgTable(
  'bill_unions',
  {
    id: serial('id').primaryKey(),
    knessetId: integer('knesset_id').unique().notNull(),
    mainBillId: integer('main_bill_id')
      .references(() => bills.id)
      .notNull(),
    unionBillId: integer('union_bill_id')
      .references(() => bills.id)
      .notNull(),
    lastUpdated: timestamp('last_updated', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.mainBillId, t.unionBillId)],
);

export const billSplits = pgTable(
  'bill_splits',
  {
    id: serial('id').primaryKey(),
    knessetId: integer('knesset_id').unique().notNull(),
    mainBillId: integer('main_bill_id')
      .references(() => bills.id)
      .notNull(),
    splitBillId: integer('split_bill_id')
      .references(() => bills.id)
      .notNull(),
    name: text('name'),
    lastUpdated: timestamp('last_updated', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.mainBillId, t.splitBillId)],
);

export const billNames = pgTable('bill_names', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  billId: integer('bill_id')
    .references(() => bills.id)
    .notNull(),
  name: text('name').notNull(),
  nameHistoryTypeId: integer('name_history_type_id'),
  nameHistoryTypeDesc: text('name_history_type_desc'),
  lastUpdated: timestamp('last_updated', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────
// Bill Documents (synced from KNS_DocumentBill)
// ──────────────────────────────────────

export const billDocuments = pgTable('bill_documents', {
  id: serial('id').primaryKey(),
  knessetDocId: integer('knesset_doc_id').unique().notNull(),
  billId: integer('bill_id').references(() => bills.id),
  knessetBillId: integer('knesset_bill_id').notNull(),
  groupTypeId: integer('group_type_id').notNull(),
  groupTypeDesc: text('group_type_desc').notNull(),
  applicationDesc: text('application_desc').notNull(),
  filePath: text('file_path').notNull(),
  lastUpdated: timestamp('last_updated', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────
// Bill Stage Summaries (per-stage AI summary history)
// ──────────────────────────────────────

export const billStageSummaries = pgTable(
  'bill_stage_summaries',
  {
    id: serial('id').primaryKey(),
    billId: integer('bill_id')
      .references(() => bills.id)
      .notNull(),
    stage: integer('stage').notNull(),
    summary: jsonb('summary').$type<Record<string, string>>().notNull(),
    topics: jsonb('topics').$type<Record<string, string[]>>(),
    sourceDocType: integer('source_doc_type'),
    sourceDocId: integer('source_doc_id').references(() => billDocuments.id),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.billId, t.stage)],
);

// ──────────────────────────────────────
// Bill Clusters (unified legislation entities)
// ──────────────────────────────────────

export const billClusters = pgTable('bill_clusters', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  primaryBillId: integer('primary_bill_id'),
  currentStage: integer('current_stage'),
  specialStatus: text('special_status'),
  billType: text('bill_type'),
  latestKnessetNum: integer('latest_knesset_num'),
  billCount: integer('bill_count').default(1),
  hasUnions: boolean('has_unions').default(false),
  hasSplits: boolean('has_splits').default(false),
  hasCrossTermBills: boolean('has_cross_term_bills').default(false),
  aiProcessed: boolean('ai_processed').default(false),
  aiConfidence: real('ai_confidence'),
  latestUpdate: timestamp('latest_update', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const billClusterMembers = pgTable(
  'bill_cluster_members',
  {
    id: serial('id').primaryKey(),
    clusterId: integer('cluster_id')
      .references(() => billClusters.id)
      .notNull(),
    billId: integer('bill_id')
      .references(() => bills.id)
      .notNull(),
    relationshipType: text('relationship_type').notNull(),
    confidence: real('confidence').default(1.0),
    isOrigin: boolean('is_origin').default(false),
    isPrimary: boolean('is_primary').default(false),
    aiReasoning: text('ai_reasoning'),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.billId)],
);

export const billEmbeddings = pgTable('bill_embeddings', {
  id: serial('id').primaryKey(),
  billId: integer('bill_id')
    .references(() => bills.id)
    .unique()
    .notNull(),
  embedding: vector('embedding', 768),
  model: text('model').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const committees = pgTable('committees', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  name: text('name').notNull(),
  committeeType: text('committee_type'),
  knessetNum: integer('knesset_num'),
  isActive: boolean('is_active').default(true),
  chairmanId: integer('chairman_id').references(() => members.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const committeeSessions = pgTable('committee_sessions', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  committeeId: integer('committee_id')
    .references(() => committees.id)
    .notNull(),
  sessionDate: timestamp('session_date', { withTimezone: true }),
  title: text('title'),
  protocolUrl: text('protocol_url'),
  topics: text('topics').array(),
  aiSummary: text('ai_summary'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const budgetItems = pgTable(
  'budget_items',
  {
    id: serial('id').primaryKey(),
    budgetCode: text('budget_code').notNull(),
    year: integer('year').notNull(),
    title: text('title').notNull(),
    amountAllocated: bigint('amount_allocated', { mode: 'number' }),
    amountUsed: bigint('amount_used', { mode: 'number' }),
    parentCode: text('parent_code'),
    depth: integer('depth'),
    ministry: text('ministry'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.budgetCode, t.year)],
);

// ──────────────────────────────────────
// Integrity & Ethics
// ──────────────────────────────────────

export const integrityCases = pgTable('integrity_cases', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => members.id)
    .notNull(),
  category: text('category').notNull(), // 'ethics_complaint' | 'immunity_request' | 'criminal_indictment' | 'criminal_conviction' | 'comptroller_finding' | 'conflict_of_interest' | 'regulatory_sanction' | 'disciplinary_action' | 'financial_disclosure_issue'
  severity: text('severity').notNull().default('info'), // 'info' | 'warning' | 'serious' | 'critical'
  status: text('status').notNull().default('reported'), // 'reported' | 'under_investigation' | 'decided' | 'appealed' | 'closed' | 'convicted' | 'acquitted' | 'sanctions_applied'
  title: text('title').notNull(),
  titleEn: text('title_en'),
  description: text('description'),
  descriptionEn: text('description_en'),
  sourceType: text('source_type').notNull(), // 'knesset_ethics_committee' | 'knesset_house_committee' | 'state_comptroller' | 'court_ruling' | 'government_registry' | 'police_investigation' | 'attorney_general' | 'official_gazette'
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url'),
  sourceDocId: text('source_doc_id'),
  eventDate: date('event_date').notNull(),
  reportedDate: date('reported_date'),
  resolutionDate: date('resolution_date'),
  decision: text('decision'),
  sanctionType: text('sanction_type'),
  financialAmount: numeric('financial_amount'),
  metadata: jsonb('metadata'),
  aiSummary: text('ai_summary'),
  aiConfidence: real('ai_confidence'),
  verified: boolean('verified').default(false),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const integrityCaseLinks = pgTable(
  'integrity_case_links',
  {
    id: serial('id').primaryKey(),
    caseId: integer('case_id')
      .references(() => integrityCases.id, { onDelete: 'cascade' })
      .notNull(),
    relatedCaseId: integer('related_case_id')
      .references(() => integrityCases.id, { onDelete: 'cascade' })
      .notNull(),
    linkType: text('link_type').notNull(), // 'preceded_by' | 'followed_by' | 'related_to' | 'appeals'
  },
  (t) => [unique().on(t.caseId, t.relatedCaseId)],
);

export const integrityDocuments = pgTable('integrity_documents', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .references(() => integrityCases.id, { onDelete: 'cascade' })
    .notNull(),
  docType: text('doc_type').notNull(), // 'protocol' | 'ruling' | 'report' | 'indictment' | 'response' | 'other'
  title: text('title').notNull(),
  url: text('url'),
  filePath: text('file_path'),
  publishedAt: date('published_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const memberCorporateAffiliations = pgTable(
  'member_corporate_affiliations',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .references(() => members.id)
      .notNull(),
    companyNumber: text('company_number').notNull(),
    companyName: text('company_name').notNull(),
    role: text('role').notNull(), // 'director' | 'shareholder' | 'officer' | 'beneficiary'
    status: text('status').default('active'), // 'active' | 'inactive' | 'dissolved'
    startDate: date('start_date'),
    endDate: date('end_date'),
    sourceUrl: text('source_url'),
    potentialConflict: boolean('potential_conflict').default(false),
    conflictDescription: text('conflict_description'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.memberId, t.companyNumber, t.role)],
);

export const memberLobbyistConnections = pgTable(
  'member_lobbyist_connections',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .references(() => members.id)
      .notNull(),
    lobbyistName: text('lobbyist_name').notNull(),
    lobbyistNumber: text('lobbyist_number'),
    clientName: text('client_name'),
    connectionType: text('connection_type').notNull(), // 'meeting' | 'committee_attendance' | 'registered_contact'
    eventDate: date('event_date'),
    sourceUrl: text('source_url'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.memberId, t.lobbyistName, t.eventDate)],
);

// ──────────────────────────────────────
// Election Campaigns (2026+)
// ──────────────────────────────────────

export const electionCampaigns = pgTable('election_campaigns', {
  id: serial('id').primaryKey(),
  knessetNum: integer('knesset_num').unique().notNull(),
  electionDate: date('election_date'), // nullable until confirmed
  status: text('status').notNull().default('pre_campaign'), // 'pre_campaign' | 'campaign' | 'election_day' | 'results' | 'completed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const electionCandidateLists = pgTable('election_candidate_lists', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .references(() => electionCampaigns.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  slug: text('slug').unique().notNull(),
  ballotLetters: text('ballot_letters'), // nullable until Phase 2
  politicalGroupId: integer('political_group_id').references(
    () => politicalGroups.id,
  ), // nullable for new parties
  leaderName: text('leader_name'),
  leaderMemberId: integer('leader_member_id').references(() => members.id),
  status: text('status').notNull().default('potential'), // 'potential' | 'confirmed' | 'withdrawn' | 'disqualified'
  color: text('color'), // hex
  logoUrl: text('logo_url'),
  platformSummary: text('platform_summary'),
  platformUrl: text('platform_url'),
  estimatedSeats: integer('estimated_seats'),
  politicalPosition: text('political_position'), // 'left' | 'center_left' | 'center' | 'center_right' | 'right' | 'arab' | 'haredi'
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const electionCandidates = pgTable('election_candidates', {
  id: serial('id').primaryKey(),
  candidateListId: integer('candidate_list_id')
    .references(() => electionCandidateLists.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id').references(() => members.id), // nullable — linked only if already an MK
  slug: text('slug').unique().notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  position: integer('position'), // list position, nullable until Phase 2
  status: text('status').notNull().default('potential'), // 'potential' | 'confirmed' | 'removed'
  isLeader: boolean('is_leader').default(false),
  // Profile fields
  bio: text('bio'),
  imageUrl: text('image_url'),
  birthYear: integer('birth_year'),
  residence: text('residence'), // city/area
  profession: text('profession'),
  education: text('education'),
  // Civic / public record
  civicActivity: text('civic_activity'),
  publicStatements: text('public_statements'),
  platformUrl: text('platform_url'),
  // Integrity fields
  integrityNotes: text('integrity_notes'),
  financialDisclosure: text('financial_disclosure'),
  conflictsOfInterest: text('conflicts_of_interest'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const electionPolls = pgTable('election_polls', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .references(() => electionCampaigns.id, { onDelete: 'cascade' })
    .notNull(),
  pollsterName: text('pollster_name').notNull(),
  publishDate: date('publish_date').notNull(),
  sampleSize: integer('sample_size'),
  marginOfError: numeric('margin_of_error', { precision: 3, scale: 1 }),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const electionPollResults = pgTable(
  'election_poll_results',
  {
    id: serial('id').primaryKey(),
    pollId: integer('poll_id')
      .references(() => electionPolls.id, { onDelete: 'cascade' })
      .notNull(),
    candidateListId: integer('candidate_list_id')
      .references(() => electionCandidateLists.id, { onDelete: 'cascade' })
      .notNull(),
    predictedSeats: integer('predicted_seats').notNull(),
  },
  (t) => [unique().on(t.pollId, t.candidateListId)],
);

export const electionTimelineEvents = pgTable('election_timeline_events', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .references(() => electionCampaigns.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: date('event_date').notNull(),
  type: text('type').notNull(), // 'deadline' | 'event' | 'debate' | 'announcement' | 'milestone'
  isCompleted: boolean('is_completed').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────
// Sync tracking
// ──────────────────────────────────────

export const syncLog = pgTable('sync_log', {
  id: serial('id').primaryKey(),
  entity: text('entity').unique().notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }).notNull(),
  recordCount: integer('record_count'),
  status: text('status').notNull(), // 'success', 'failed'
  errorMessage: text('error_message'),
  lastCheckpoint: text('last_checkpoint'), // JSON checkpoint data for incremental sync
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────
// Relations
// ──────────────────────────────────────

export const politicalGroupsRelations = relations(
  politicalGroups,
  ({ many }) => ({
    factions: many(factions),
    lineageAsSource: many(politicalGroupLineage, {
      relationName: 'lineageSource',
    }),
    lineageAsTarget: many(politicalGroupLineage, {
      relationName: 'lineageTarget',
    }),
  }),
);

export const politicalGroupLineageRelations = relations(
  politicalGroupLineage,
  ({ one }) => ({
    sourceGroup: one(politicalGroups, {
      fields: [politicalGroupLineage.sourceGroupId],
      references: [politicalGroups.id],
      relationName: 'lineageSource',
    }),
    targetGroup: one(politicalGroups, {
      fields: [politicalGroupLineage.targetGroupId],
      references: [politicalGroups.id],
      relationName: 'lineageTarget',
    }),
  }),
);

export const factionsRelations = relations(factions, ({ one, many }) => ({
  members: many(members),
  politicalGroup: one(politicalGroups, {
    fields: [factions.politicalGroupId],
    references: [politicalGroups.id],
  }),
  electoralList: one(electoralLists, {
    fields: [factions.electoralListId],
    references: [electoralLists.id],
  }),
  partyLinks: many(partyFactionLinks),
  compositionHistory: many(factionCompositionHistory),
  memberHistory: many(memberFactionHistory),
  coalitionPeriods: many(factionCoalitionPeriods),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  faction: one(factions, {
    fields: [members.factionId],
    references: [factions.id],
  }),
  votes: many(memberVotes),
  initiatedBills: many(billInitiators),
  factionHistory: many(memberFactionHistory),
  governmentPositions: many(governmentPositions),
  integrityCases: many(integrityCases),
  corporateAffiliations: many(memberCorporateAffiliations),
  lobbyistConnections: many(memberLobbyistConnections),
}));

export const politicalPartiesRelations = relations(
  politicalParties,
  ({ many }) => ({
    financialReports: many(partyFinancialReports),
    electoralListLinks: many(electoralListParties),
    factionLinks: many(partyFactionLinks),
    compositionHistory: many(factionCompositionHistory),
  }),
);

export const electoralListsRelations = relations(
  electoralLists,
  ({ many }) => ({
    factions: many(factions),
    partyLinks: many(electoralListParties),
  }),
);

export const partyFinancialReportsRelations = relations(
  partyFinancialReports,
  ({ one }) => ({
    party: one(politicalParties, {
      fields: [partyFinancialReports.partyId],
      references: [politicalParties.id],
    }),
  }),
);

export const electoralListPartiesRelations = relations(
  electoralListParties,
  ({ one }) => ({
    electoralList: one(electoralLists, {
      fields: [electoralListParties.electoralListId],
      references: [electoralLists.id],
    }),
    party: one(politicalParties, {
      fields: [electoralListParties.partyId],
      references: [politicalParties.id],
    }),
  }),
);

export const partyFactionLinksRelations = relations(
  partyFactionLinks,
  ({ one }) => ({
    party: one(politicalParties, {
      fields: [partyFactionLinks.partyId],
      references: [politicalParties.id],
    }),
    faction: one(factions, {
      fields: [partyFactionLinks.factionId],
      references: [factions.id],
    }),
  }),
);

export const factionCompositionHistoryRelations = relations(
  factionCompositionHistory,
  ({ one }) => ({
    faction: one(factions, {
      fields: [factionCompositionHistory.factionId],
      references: [factions.id],
    }),
    party: one(politicalParties, {
      fields: [factionCompositionHistory.partyId],
      references: [politicalParties.id],
    }),
  }),
);

export const memberFactionHistoryRelations = relations(
  memberFactionHistory,
  ({ one }) => ({
    member: one(members, {
      fields: [memberFactionHistory.memberId],
      references: [members.id],
    }),
    faction: one(factions, {
      fields: [memberFactionHistory.factionId],
      references: [factions.id],
    }),
  }),
);

export const factionCoalitionPeriodsRelations = relations(
  factionCoalitionPeriods,
  ({ one }) => ({
    faction: one(factions, {
      fields: [factionCoalitionPeriods.factionId],
      references: [factions.id],
    }),
  }),
);

export const votesRelations = relations(votes, ({ one, many }) => ({
  bill: one(bills, {
    fields: [votes.billId],
    references: [bills.id],
  }),
  memberVotes: many(memberVotes),
}));

export const memberVotesRelations = relations(memberVotes, ({ one }) => ({
  vote: one(votes, {
    fields: [memberVotes.voteId],
    references: [votes.id],
  }),
  member: one(members, {
    fields: [memberVotes.memberId],
    references: [members.id],
  }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  initiators: many(billInitiators),
  votes: many(votes),
  unionsAsMain: many(billUnions, { relationName: 'mainBillUnions' }),
  unionsAsMerged: many(billUnions, { relationName: 'unionBillUnions' }),
  splitsAsMain: many(billSplits, { relationName: 'mainBillSplits' }),
  splitsAsChild: many(billSplits, { relationName: 'splitBillSplits' }),
  nameHistory: many(billNames),
  documents: many(billDocuments),
  stageSummaries: many(billStageSummaries),
  cluster: one(billClusters, {
    fields: [bills.clusterId],
    references: [billClusters.id],
  }),
  clusterMembership: many(billClusterMembers),
  embedding: many(billEmbeddings),
}));

export const billInitiatorsRelations = relations(billInitiators, ({ one }) => ({
  bill: one(bills, {
    fields: [billInitiators.billId],
    references: [bills.id],
  }),
  member: one(members, {
    fields: [billInitiators.memberId],
    references: [members.id],
  }),
}));

export const billUnionsRelations = relations(billUnions, ({ one }) => ({
  mainBill: one(bills, {
    fields: [billUnions.mainBillId],
    references: [bills.id],
    relationName: 'mainBillUnions',
  }),
  unionBill: one(bills, {
    fields: [billUnions.unionBillId],
    references: [bills.id],
    relationName: 'unionBillUnions',
  }),
}));

export const billSplitsRelations = relations(billSplits, ({ one }) => ({
  mainBill: one(bills, {
    fields: [billSplits.mainBillId],
    references: [bills.id],
    relationName: 'mainBillSplits',
  }),
  splitBill: one(bills, {
    fields: [billSplits.splitBillId],
    references: [bills.id],
    relationName: 'splitBillSplits',
  }),
}));

export const billNamesRelations = relations(billNames, ({ one }) => ({
  bill: one(bills, {
    fields: [billNames.billId],
    references: [bills.id],
  }),
}));

export const billDocumentsRelations = relations(billDocuments, ({ one }) => ({
  bill: one(bills, {
    fields: [billDocuments.billId],
    references: [bills.id],
  }),
}));

export const billStageSummariesRelations = relations(
  billStageSummaries,
  ({ one }) => ({
    bill: one(bills, {
      fields: [billStageSummaries.billId],
      references: [bills.id],
    }),
    sourceDoc: one(billDocuments, {
      fields: [billStageSummaries.sourceDocId],
      references: [billDocuments.id],
    }),
  }),
);

export const billClustersRelations = relations(
  billClusters,
  ({ one, many }) => ({
    primaryBill: one(bills, {
      fields: [billClusters.primaryBillId],
      references: [bills.id],
    }),
    members: many(billClusterMembers),
  }),
);

export const billClusterMembersRelations = relations(
  billClusterMembers,
  ({ one }) => ({
    cluster: one(billClusters, {
      fields: [billClusterMembers.clusterId],
      references: [billClusters.id],
    }),
    bill: one(bills, {
      fields: [billClusterMembers.billId],
      references: [bills.id],
    }),
  }),
);

export const billEmbeddingsRelations = relations(billEmbeddings, ({ one }) => ({
  bill: one(bills, {
    fields: [billEmbeddings.billId],
    references: [bills.id],
  }),
}));

export const committeesRelations = relations(committees, ({ one, many }) => ({
  chairman: one(members, {
    fields: [committees.chairmanId],
    references: [members.id],
  }),
  sessions: many(committeeSessions),
}));

export const committeeSessionsRelations = relations(
  committeeSessions,
  ({ one }) => ({
    committee: one(committees, {
      fields: [committeeSessions.committeeId],
      references: [committees.id],
    }),
  }),
);

// ──────────────────────────────────────
// Government Relations
// ──────────────────────────────────────

export const govMinistriesRelations = relations(govMinistries, ({ many }) => ({
  positions: many(governmentPositions),
}));

export const governmentsRelations = relations(governments, ({ one, many }) => ({
  pm: one(members, {
    fields: [governments.pmMemberId],
    references: [members.id],
    relationName: 'governmentPm',
  }),
  alternatePm: one(members, {
    fields: [governments.alternatePmMemberId],
    references: [members.id],
    relationName: 'governmentAlternatePm',
  }),
  positions: many(governmentPositions),
  coalitionPeriods: many(factionCoalitionPeriods),
}));

export const governmentPositionsRelations = relations(
  governmentPositions,
  ({ one }) => ({
    government: one(governments, {
      fields: [governmentPositions.governmentId],
      references: [governments.id],
    }),
    member: one(members, {
      fields: [governmentPositions.memberId],
      references: [members.id],
    }),
    ministry: one(govMinistries, {
      fields: [governmentPositions.govMinistryId],
      references: [govMinistries.id],
    }),
  }),
);

// ──────────────────────────────────────
// Integrity Relations
// ──────────────────────────────────────

export const integrityCasesRelations = relations(
  integrityCases,
  ({ one, many }) => ({
    member: one(members, {
      fields: [integrityCases.memberId],
      references: [members.id],
    }),
    documents: many(integrityDocuments),
    linksFrom: many(integrityCaseLinks, { relationName: 'caseFrom' }),
    linksTo: many(integrityCaseLinks, { relationName: 'caseTo' }),
  }),
);

export const integrityCaseLinksRelations = relations(
  integrityCaseLinks,
  ({ one }) => ({
    case: one(integrityCases, {
      fields: [integrityCaseLinks.caseId],
      references: [integrityCases.id],
      relationName: 'caseFrom',
    }),
    relatedCase: one(integrityCases, {
      fields: [integrityCaseLinks.relatedCaseId],
      references: [integrityCases.id],
      relationName: 'caseTo',
    }),
  }),
);

export const integrityDocumentsRelations = relations(
  integrityDocuments,
  ({ one }) => ({
    case: one(integrityCases, {
      fields: [integrityDocuments.caseId],
      references: [integrityCases.id],
    }),
  }),
);

export const memberCorporateAffiliationsRelations = relations(
  memberCorporateAffiliations,
  ({ one }) => ({
    member: one(members, {
      fields: [memberCorporateAffiliations.memberId],
      references: [members.id],
    }),
  }),
);

export const memberLobbyistConnectionsRelations = relations(
  memberLobbyistConnections,
  ({ one }) => ({
    member: one(members, {
      fields: [memberLobbyistConnections.memberId],
      references: [members.id],
    }),
  }),
);

// ──────────────────────────────────────
// Election Campaign Relations
// ──────────────────────────────────────

export const electionCampaignsRelations = relations(
  electionCampaigns,
  ({ many }) => ({
    candidateLists: many(electionCandidateLists),
    polls: many(electionPolls),
    timelineEvents: many(electionTimelineEvents),
  }),
);

export const electionCandidateListsRelations = relations(
  electionCandidateLists,
  ({ one, many }) => ({
    campaign: one(electionCampaigns, {
      fields: [electionCandidateLists.campaignId],
      references: [electionCampaigns.id],
    }),
    politicalGroup: one(politicalGroups, {
      fields: [electionCandidateLists.politicalGroupId],
      references: [politicalGroups.id],
    }),
    leader: one(members, {
      fields: [electionCandidateLists.leaderMemberId],
      references: [members.id],
    }),
    candidates: many(electionCandidates),
    pollResults: many(electionPollResults),
  }),
);

export const electionCandidatesRelations = relations(
  electionCandidates,
  ({ one }) => ({
    candidateList: one(electionCandidateLists, {
      fields: [electionCandidates.candidateListId],
      references: [electionCandidateLists.id],
    }),
    member: one(members, {
      fields: [electionCandidates.memberId],
      references: [members.id],
    }),
  }),
);

export const electionPollsRelations = relations(
  electionPolls,
  ({ one, many }) => ({
    campaign: one(electionCampaigns, {
      fields: [electionPolls.campaignId],
      references: [electionCampaigns.id],
    }),
    results: many(electionPollResults),
  }),
);

export const electionPollResultsRelations = relations(
  electionPollResults,
  ({ one }) => ({
    poll: one(electionPolls, {
      fields: [electionPollResults.pollId],
      references: [electionPolls.id],
    }),
    candidateList: one(electionCandidateLists, {
      fields: [electionPollResults.candidateListId],
      references: [electionCandidateLists.id],
    }),
  }),
);

export const electionTimelineEventsRelations = relations(
  electionTimelineEvents,
  ({ one }) => ({
    campaign: one(electionCampaigns, {
      fields: [electionTimelineEvents.campaignId],
      references: [electionCampaigns.id],
    }),
  }),
);

// ──────────────────────────────────────
// Admin
// ──────────────────────────────────────

export const adminActivityLog = pgTable('admin_activity_log', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(), // e.g. 'inline_relink_vote', 'approve_cluster', 'verify_integrity'
  entityType: text('entity_type').notNull(), // 'vote', 'bill', 'cluster', 'integrity_case', 'member'
  entityId: text('entity_id').notNull(),
  details: jsonb('details'), // JSON with old/new values, reason, etc.
  adminIdentifier: text('admin_identifier').notNull(), // who performed the action
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
