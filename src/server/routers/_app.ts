import { router } from '../trpc';
import { membersRouter } from './members';
import { votesRouter } from './votes';
import { billsRouter } from './bills';
import { factionsRouter } from './factions';
import { politicalPartiesRouter } from './political-parties';
import { electoralListsRouter } from './electoral-lists';
import { governmentsRouter } from './governments';
import { politicalGroupsRouter } from './political-groups';
import { integrityRouter } from './integrity';
import { elections2026Router } from './elections-2026';
import { electionMapRouter } from './election-map';
import { billClustersRouter } from './bill-clusters';
import { adminRouter } from './admin';

export const appRouter = router({
  members: membersRouter,
  votes: votesRouter,
  bills: billsRouter,
  factions: factionsRouter,
  politicalParties: politicalPartiesRouter,
  electoralLists: electoralListsRouter,
  governments: governmentsRouter,
  politicalGroups: politicalGroupsRouter,
  integrity: integrityRouter,
  elections2026: elections2026Router,
  electionMap: electionMapRouter,
  billClusters: billClustersRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
