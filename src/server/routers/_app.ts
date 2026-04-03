import { router } from '../trpc';
import { membersRouter } from './members';
import { votesRouter } from './votes';
import { billsRouter } from './bills';
import { factionsRouter } from './factions';
import { politicalPartiesRouter } from './political-parties';
import { electoralListsRouter } from './electoral-lists';

export const appRouter = router({
  members: membersRouter,
  votes: votesRouter,
  bills: billsRouter,
  factions: factionsRouter,
  politicalParties: politicalPartiesRouter,
  electoralLists: electoralListsRouter,
});

export type AppRouter = typeof appRouter;
