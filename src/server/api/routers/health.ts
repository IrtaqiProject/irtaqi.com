import { protectedProcedure, publicProcedure, createTRPCRouter } from "../trpc";

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({
    status: "ok",
    message: "tRPC is alive",
    time: new Date().toISOString(),
  })),
  secret: protectedProcedure.query(({ ctx }) => ({
    user: ctx.session?.user ?? null,
    message: "Protected route reached",
  })),
});
