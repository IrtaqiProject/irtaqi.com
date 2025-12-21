"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAtom } from "jotai";
import { ShieldCheck, Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  accountAtom,
  accountErrorAtom,
  accountLoadingAtom,
} from "@/state/account-atoms";
import { cn } from "@/lib/utils";

export function AccountBadge({ className }) {
  const [account, setAccount] = useAtom(accountAtom);
  const [loading, setLoading] = useAtom(accountLoadingAtom);
  const [error, setError] = useAtom(accountErrorAtom);

  useEffect(() => {
    if (loading || account || error) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/account", { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(json?.error || "Gagal mengambil akun.");
        }
        setAccount(json.account ?? null);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Tidak bisa memuat akun."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [account, loading, error, setAccount, setError, setLoading]);

  const tokenText = account?.isSubscribed
    ? `${account.subscriptionLabel} - Unlimited`
    : `${account?.tokens ?? "?"} / ${(account?.maxTokens ?? 20).toString()} token`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow-lg backdrop-blur",
        className
      )}
    >
      <div className="flex items-center gap-2 text-white">
        <Coins className="h-4 w-4 text-amber-300" />
        <span className="font-semibold">
          {loading ? "Memuat token..." : tokenText}
        </span>
        {account?.isSubscribed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
            <ShieldCheck className="h-3 w-3" />
            Active
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Free
          </span>
        )}
      </div>
      {error ? (
        <span className="text-xs text-amber-300">{error}</span>
      ) : null}
      {!account?.isSubscribed && (
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="bg-white/10 text-white hover:bg-white/20"
        >
          <Link href="/user">Upgrade</Link>
        </Button>
      )}
    </div>
  );
}
