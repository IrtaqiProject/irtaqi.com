"use client";

import { atom, useAtom } from "jotai";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { healthCheck, healthSecret } from "@/actions/health";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatusPanel() {
  const { data: session } = useSession();
  const healthAtom = useRef(atom(null)).current;
  const secretAtom = useRef(atom(null)).current;
  const healthLoadingAtom = useRef(atom(true)).current;
  const secretStateAtom = useRef(atom({ loading: false, error: "" })).current;
  const [health, setHealth] = useAtom(healthAtom);
  const [secret, setSecret] = useAtom(secretAtom);
  const [isHealthLoading, setIsHealthLoading] = useAtom(healthLoadingAtom);
  const [secretState, setSecretState] = useAtom(secretStateAtom);

  useEffect(() => {
    let active = true;
    async function loadHealth() {
      setIsHealthLoading(true);
      try {
        const data = await healthCheck();
        if (active) setHealth(data);
      } catch (error) {
        if (active) setHealth(null);
      } finally {
        if (active) setIsHealthLoading(false);
      }
    }
    loadHealth();
    return () => {
      active = false;
    };
  }, []);

  const fetchSecret = async () => {
    if (!session) return;
    setSecretState({ loading: true, error: "" });
    try {
      const data = await healthSecret();
      setSecret(data);
    } catch (error) {
      setSecret(null);
      setSecretState({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }
    setSecretState({ loading: false, error: "" });
  };

  return (
    <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-0">
        <div>
          <CardTitle>Live status</CardTitle>
          <CardDescription>Server action + NextAuth wiring check</CardDescription>
        </div>
        {isHealthLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
              health ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {health ? "Online" : "Offline"}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">
            {health?.message ?? "Waiting for server action ping..."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            {health?.time ? `Server time: ${health.time}` : "Server time will appear when online."}
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {session ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldOff className="h-5 w-5 text-amber-500" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {session ? session.user?.email ?? "Signed in" : "Not authenticated"}
              </p>
              <p className="text-xs text-muted-foreground">
                {session ? "Protected server actions enabled." : "Sign in to access protected calls."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {session ? (
              <>
                <Button variant="secondary" onClick={fetchSecret} disabled={secretState.loading}>
                  {secretState.loading ? "Loading..." : "Call protected"}
                </Button>
                <Button variant="outline" onClick={() => signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button onClick={() => signIn("google")}>Sign in with Google</Button>
            )}
          </div>
        </div>
        {secret && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-primary">Protected data</p>
            <p className="text-muted-foreground">
              {JSON.stringify(secret, null, 2)}
            </p>
          </div>
        )}
        {secretState.error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {secretState.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
