import { createTRPCRouter } from './trpc.js';
import { telegramRouter } from './routers/telegram.js';

// Root router that combines all routers
export const appRouter = createTRPCRouter({
  telegram: telegramRouter,
});

// Export type for client usage
export const AppRouter = appRouter;
