"use client";

import { Suspense } from "react";
import { useAtom } from "jotai";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus, Mail, Lock, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

import { signupAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  signupErrorAtom,
  signupFormAtom,
  signupLoadingAtom,
  signupSuccessAtom,
} from "@/state/auth-atoms";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/transcribe";
  const [form, setForm] = useAtom(signupFormAtom);
  const [loading, setLoading] = useAtom(signupLoadingAtom);
  const [error, setError] = useAtom(signupErrorAtom);
  const [success, setSuccess] = useAtom(signupSuccessAtom);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await signupAction(form);
      setSuccess(true);
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal daftar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] px-4 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/5 text-white backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold">Buat akun Irtaqi</CardTitle>
          <CardDescription className="text-white/70">
            Daftar dengan email atau langsung masuk lewat Google, lalu mulai transcribe & buat quiz dari kajian.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1 text-sm text-white/80">
              <span>Nama</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <UserPlus className="h-4 w-4 text-white/60" />
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  placeholder="Nama lengkap"
                />
              </div>
            </label>
            <label className="block space-y-1 text-sm text-white/80">
              <span>Email</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Mail className="h-4 w-4 text-white/60" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  placeholder="you@email.com"
                />
              </div>
            </label>
            <label className="block space-y-1 text-sm text-white/80">
              <span>Password</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Lock className="h-4 w-4 text-white/60" />
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  placeholder="Minimal 6 karakter"
                />
              </div>
            </label>
            {error ? <p className="text-sm text-amber-300">{error}</p> : null}
            {success ? (
              <p className="flex items-center gap-2 text-sm text-emerald-200">
                <CheckCircle className="h-4 w-4" /> Akun dibuat! Anda akan diarahkan...
              </p>
            ) : null}
            <Button
              type="submit"
              className={cn("w-full bg-gradient-to-r from-[#ff7ce5] via-[#9b5cff] to-[#4f46e5] text-white")}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Daftar & Masuk
            </Button>
          </form>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">atau</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full bg-white text-[#1b1145] hover:bg-white/90"
            onClick={() => signIn("google", { callbackUrl })}
          >
            Daftar / Masuk dengan Google
          </Button>
          <div className="flex items-center justify-between text-sm text-white/70">
            <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-emerald-200">
              <ArrowLeft className="h-4 w-4" /> Kembali ke login
            </Link>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-[#1b1145] hover:bg-white/90"
              onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)}
            >
              Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function SignupFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] text-white">
      <Loader2 className="h-6 w-6 animate-spin text-white/70" />
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  );
}
