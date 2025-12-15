"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { AccountBadge } from "@/components/account-badge";

const steps = [
  { key: "transcribe", label: "Transcribe", href: "/transcribe", step: 1 },
  { key: "summary", label: "Summarize", href: "/summary", step: 2 },
  { key: "qa", label: "Q&A", href: "/qa", step: 3 },
  { key: "mindmap", label: "Mindmap", href: "/mindmap", step: 4 },
  { key: "quiz", label: "Quiz", href: "/quiz", step: 5 },
];

export function StepLayout({ activeKey, title, subtitle, children }) {
  const activeStep = steps.find((item) => item.key === activeKey);
  const stepLabel = activeStep ? `Langkah ${activeStep.step} · ${activeStep.label}` : "Langkah";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0b0920] via-[#0f102b] to-[#11113a] pb-20 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#7a5bff]/25 blur-3xl" />
        <div className="absolute right-[-10%] top-0 h-80 w-80 rounded-full bg-[#4a9dff]/20 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-80 w-80 rounded-full bg-[#ff67d9]/18 blur-3xl" />
      </div>

      <div className="container relative max-w-5xl space-y-8 py-12">
        <div className="flex flex-col items-center gap-4">
          <nav className="flex justify-center">
            <div className="flex flex-wrap gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              {steps.map((item) => {
                const isActive = item.key === activeKey;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition",
                      isActive
                        ? "border-[#7c8dff] bg-[#6f7bff] text-white shadow-[0_8px_24px_rgba(111,123,255,0.45)]"
                        : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
          <AccountBadge />
        </div>

        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold text-[#8ee1c2]">{stepLabel}</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
          {subtitle ? <p className="text-white/75">{subtitle}</p> : null}
        </div>

        {children}
      </div>
    </main>
  );
}
