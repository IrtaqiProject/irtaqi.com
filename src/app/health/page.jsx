import { healthCheck, healthSecret } from "@/actions/health";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const health = await healthCheck();
  let secret = null;
  let secretError = "";

  try {
    secret = await healthSecret();
  } catch (error) {
    secretError = error instanceof Error ? error.message : "Unauthorized";
  }

  return (
    <main className="container space-y-6 py-12 text-white">
      <div>
        <p className="text-sm font-semibold text-emerald-200">Health check</p>
        <h1 className="text-3xl font-bold">Server action status</h1>
        <p className="text-white/70">Live ping and protected data without hitting API routes.</p>
      </div>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader>
          <CardTitle>Public</CardTitle>
          <CardDescription className="text-white/70">
            Result from `healthCheck` server action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Status: {health.status}</p>
          <p>Message: {health.message}</p>
          <p>Time: {health.time}</p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader>
          <CardTitle>Protected</CardTitle>
          <CardDescription className="text-white/70">
            Result from `healthSecret` server action (requires session).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {secret ? (
            <>
              <p>User: {secret.user?.email ?? "unknown"}</p>
              <p>Message: {secret.message}</p>
              <p>Time: {secret.time}</p>
            </>
          ) : (
            <p className="text-amber-300">{secretError || "Unauthorized"}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
