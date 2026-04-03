import { syncMembers } from './jobs/sync-members';
import { syncVotes } from './jobs/sync-votes';
import { syncBills } from './jobs/sync-bills';
import { syncCommittees } from './jobs/sync-committees';
import { syncMemberImages } from './jobs/sync-images';
import { syncRegisteredParties } from './jobs/sync-registered-parties';
import { syncElectoralLists } from './jobs/sync-electoral-lists';
import { syncPoliticalLinks } from './jobs/sync-political-links';

export const syncJobs = {
  members: syncMembers,
  votes: syncVotes,
  bills: syncBills,
  committees: syncCommittees,
  images: syncMemberImages,
  registeredParties: syncRegisteredParties,
  electoralLists: syncElectoralLists,
  politicalLinks: syncPoliticalLinks,
  all: async () => {
    await syncMembers();
    await syncVotes();
    await syncBills();
    await syncCommittees();
    await syncMemberImages();
    await syncRegisteredParties();
    await syncElectoralLists();
    // Links must run after parties + lists + factions
    await syncPoliticalLinks();
  },
} as const;

export type SyncJobName = keyof typeof syncJobs;
