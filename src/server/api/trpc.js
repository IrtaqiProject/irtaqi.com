import { getServerSession } from "next-auth";
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";

import { authOptions } from "@/lib/auth";

export async function createTRPCContext() {
  const session = await getServerSession(authOptions);

  return { session };
}

const t = initTRPC.context().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
