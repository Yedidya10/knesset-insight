import { router } from '../trpc';
import { membersRouter } from './members';
import { votesRouter } from './votes';
import { billsRouter } from './bills';
import { factionsRouter } from './factions';
import { politicalPartiesRouter } from './political-parties';
import { electoralListsRouter } from './electoral-lists';
import { governmentsRouter } from './governments';

export const appRouter = router({
  members: membersRouter,
  votes: votesRouter,
  bills: billsRouter,
  factions: factionsRouter,
  politicalParties: politicalPartiesRouter,
  electoralLists: electoralListsRouter,
  governments: governmentsRouter,
});

export type AppRouter = typeof appRouter;
