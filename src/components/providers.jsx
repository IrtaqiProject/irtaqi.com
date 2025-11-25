"use client";

import { Provider as JotaiProvider } from "jotai";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <JotaiProvider>{children}</JotaiProvider>
    </SessionProvider>
  );
}
