import { syncMembers } from './jobs/sync-members';
import { syncVotes } from './jobs/sync-votes';

export const syncJobs = {
  members: syncMembers,
  votes: syncVotes,
} as const;

export type SyncJobName = keyof typeof syncJobs;
