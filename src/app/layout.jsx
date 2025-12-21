import "./globals.css";

import { Providers } from "@/components/providers";
import { UserBadgeFloating } from "@/components/user-badge";

export const metadata = {
  title: "RingkaskajianAi.com",
  description:
    "Next.js + Tailwind + NextAuth starter untuk YouTube transcript, LLM ringkasan/Q&A/mindmap, dan Postgres.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased font-sans">
        <Providers>
          <UserBadgeFloating />
          {children}
        </Providers>
      </body>
    </html>
  );
}
