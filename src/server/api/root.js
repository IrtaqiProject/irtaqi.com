import { createTRPCRouter } from "./trpc";
import { healthRouter } from "./routers/health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
});
