import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata = {
  title: "Irtaqi AI Boilerplate",
  description:
    "Next.js + Tailwind + NextAuth starter untuk YouTube transcript, LLM ringkasan/Q&A/mindmap, dan Postgres.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
