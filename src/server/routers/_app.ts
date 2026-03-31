import { router } from '../trpc';
import { membersRouter } from './members';
import { votesRouter } from './votes';
import { billsRouter } from './bills';
import { partiesRouter } from './parties';

export const appRouter = router({
  members: membersRouter,
  votes: votesRouter,
  bills: billsRouter,
  parties: partiesRouter,
});

export type AppRouter = typeof appRouter;
