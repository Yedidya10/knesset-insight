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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ──────────────────────────────────────
// Core Tables
// ──────────────────────────────────────

export const parties = pgTable('parties', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  name: text('name').notNull(),
  knessetNum: integer('knesset_num'),
  isCoalition: boolean('is_coalition').default(false),
  seats: integer('seats'),
  color: text('color'),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  knessetId: integer('knesset_id').unique().notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  partyId: integer('party_id').references(() => parties.id),
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

export const partiesRelations = relations(parties, ({ many }) => ({
  members: many(members),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  party: one(parties, {
    fields: [members.partyId],
    references: [parties.id],
  }),
  votes: many(memberVotes),
  initiatedBills: many(billInitiators),
}));

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
