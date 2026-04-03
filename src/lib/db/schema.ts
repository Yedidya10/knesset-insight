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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
  electoralListId: integer('electoral_list_id').references(
    () => electoralLists.id,
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  factionId: integer('faction_id').references(() => factions.id),
  isCurrent: boolean('is_current').default(false),
  gender: text('gender'),
  birthDate: date('birth_date'),
  imageUrl: text('image_url'),
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
  knessetNum: integer('knesset_num'),
  proposedDate: date('proposed_date'),
  lastUpdate: timestamp('last_update', { withTimezone: true }),
  category: text('category'),
  fullTextUrl: text('full_text_url'),
  aiSummary: text('ai_summary'),
  metadata: jsonb('metadata'),
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
// Sync tracking
// ──────────────────────────────────────

export const syncLog = pgTable('sync_log', {
  id: serial('id').primaryKey(),
  entity: text('entity').unique().notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }).notNull(),
  recordCount: integer('record_count'),
  status: text('status').notNull(), // 'success', 'failed'
  errorMessage: text('error_message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────
// Relations
// ──────────────────────────────────────

export const factionsRelations = relations(factions, ({ one, many }) => ({
  members: many(members),
  electoralList: one(electoralLists, {
    fields: [factions.electoralListId],
    references: [electoralLists.id],
  }),
  partyLinks: many(partyFactionLinks),
  memberHistory: many(memberFactionHistory),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  faction: one(factions, {
    fields: [members.factionId],
    references: [factions.id],
  }),
  votes: many(memberVotes),
  initiatedBills: many(billInitiators),
  factionHistory: many(memberFactionHistory),
}));

export const politicalPartiesRelations = relations(
  politicalParties,
  ({ many }) => ({
    financialReports: many(partyFinancialReports),
    electoralListLinks: many(electoralListParties),
    factionLinks: many(partyFactionLinks),
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

export const billsRelations = relations(bills, ({ many }) => ({
  initiators: many(billInitiators),
  votes: many(votes),
}));

export const billInitiatorsRelations = relations(
  billInitiators,
  ({ one }) => ({
    bill: one(bills, {
      fields: [billInitiators.billId],
      references: [bills.id],
    }),
    member: one(members, {
      fields: [billInitiators.memberId],
      references: [members.id],
    }),
  }),
);

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
