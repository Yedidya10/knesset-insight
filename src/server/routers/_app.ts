import { router } from '../trpc';
import { membersRouter } from './members';

export const appRouter = router({
  members: membersRouter,
});

export type AppRouter = typeof appRouter;
