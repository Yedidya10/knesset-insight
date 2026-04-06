import { syncMembers } from './jobs/sync-members';
import { syncVotes } from './jobs/sync-votes';
import { syncBills } from './jobs/sync-bills';
import { syncBillInitiators } from './jobs/sync-bill-initiators';
import { syncBillUnions } from './jobs/sync-bill-unions';
import { syncBillSplits } from './jobs/sync-bill-splits';
import { syncBillNames } from './jobs/sync-bill-names';
import { syncCommittees } from './jobs/sync-committees';
import { syncMemberImages } from './jobs/sync-images';
import { syncRegisteredParties } from './jobs/sync-registered-parties';
import { syncElectoralLists } from './jobs/sync-electoral-lists';
import { syncPoliticalLinks } from './jobs/sync-political-links';
import { syncGovMinistries } from './jobs/sync-gov-ministries';
import { syncGovernments } from './jobs/sync-governments';

export const syncJobs = {
  members: syncMembers,
  votes: syncVotes,
  bills: syncBills,
  billInitiators: syncBillInitiators,
  billUnions: syncBillUnions,
  billSplits: syncBillSplits,
  billNames: syncBillNames,
  committees: syncCommittees,
  images: syncMemberImages,
  registeredParties: syncRegisteredParties,
  electoralLists: syncElectoralLists,
  politicalLinks: syncPoliticalLinks,
  govMinistries: syncGovMinistries,
  governments: syncGovernments,
  all: async () => {
    await syncMembers();
    await syncVotes();
    await syncBills();
    await syncBillInitiators();
    // Bill relations must run after bills
    await syncBillUnions();
    await syncBillSplits();
    await syncBillNames();
    await syncCommittees();
    await syncMemberImages();
    await syncRegisteredParties();
    await syncElectoralLists();
    // Links must run after parties + lists + factions
    await syncPoliticalLinks();
    // Governments must run after members + factions
    await syncGovMinistries();
    await syncGovernments();
  },
} as const;

export type SyncJobName = keyof typeof syncJobs;
