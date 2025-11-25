import { healthCheck, healthSecret } from "@/actions/health";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const gradientBg =
  "bg-gradient-to-b from-[#11092c] via-[#0f0a26] to-[#09071b]";
const panelBg =
  "border border-white/10 bg-white/5 backdrop-blur shadow-[0_20px_80px_rgba(16,12,60,0.5)]";

export default async function HealthPage() {
  const health = await healthCheck();
  let secret = null;
  let secretError = "";

  try {
    secret = await healthSecret();
  } catch (error) {
    secretError = error instanceof Error ? error.message : "Unauthorized";
  }

  const entries = [
    {
      title: "Public",
      description: "Result from `healthCheck` server action.",
      items: [
        { label: "Status", value: health.status },
        { label: "Message", value: health.message },
        { label: "Time", value: health.time },
      ],
    },
    {
      title: "Protected",
      description: "Result from `healthSecret` server action (requires session).",
      items: secret
        ? [
            { label: "User", value: secret.user?.email ?? "unknown" },
            { label: "Message", value: secret.message },
            { label: "Time", value: secret.time },
          ]
        : [{ label: "Status", value: secretError || "Unauthorized", tone: "warn" }],
    },
  ];

  return (
    <main className={cn("relative min-h-screen overflow-hidden text-white", gradientBg)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-80 w-80 rounded-full bg-[#7b5dff]/25 blur-3xl" />
        <div className="absolute right-[-5%] top-20 h-72 w-72 rounded-full bg-[#ff7a6a]/20 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[25%] h-96 w-96 rounded-full bg-[#5ac8ff]/18 blur-3xl" />
      </div>

      <div className="container relative space-y-8 py-14">
        <div className="max-w-3xl space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Health check
          </span>
          <h1 className="font-display text-4xl font-semibold leading-tight text-white">
            Server action status
          </h1>
          <p className="text-lg text-white/75">
            Live ping and protected data without hitting API routes. Styled to match the main landing
            gradients and pill shapes.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.title} className={cn(panelBg, "text-white")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{entry.title}</CardTitle>
                    <CardDescription className="text-white/70">
                      {entry.description}
                    </CardDescription>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {entry.title === "Public" ? "Open" : "Auth"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.items.map((item) => (
                  <div
                    key={`${entry.title}-${item.label}`}
                    className="flex items-start justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">{item.label}</p>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          item.tone === "warn" ? "text-amber-300" : "text-white",
                        )}
                      >
                        {item.value}
                      </p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
