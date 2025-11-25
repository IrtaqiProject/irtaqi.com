"use client";

import { Provider as JotaiProvider, atom, useAtom } from "jotai";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import superjson from "superjson";

import { trpc } from "@/lib/trpc/client";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

const queryClientAtom = atom(new QueryClient());
const trpcClientAtom = atom(
  trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
      }),
    ],
  }),
);

export function Providers({ children }) {
  const [queryClient] = useAtom(queryClientAtom);
  const [trpcClient] = useAtom(trpcClientAtom);

  return (
    <SessionProvider>
      <JotaiProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
      </JotaiProvider>
    </SessionProvider>
  );
}
