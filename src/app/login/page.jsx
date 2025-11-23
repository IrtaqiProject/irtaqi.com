"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      redirect: false,
      email: form.email,
      password: form.password,
    });
    setLoading(false);
    if (res?.error) {
      setError("Login gagal, cek email/password.");
    } else {
      router.push("/");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] px-4 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/5 text-white backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold">Masuk ke Irtaqi</CardTitle>
          <CardDescription className="text-white/70">
            Gunakan akun email/password atau login dengan Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onSubmit}>
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
                  placeholder="••••••••"
                />
              </div>
            </label>
            {error ? <p className="text-sm text-amber-300">{error}</p> : null}
            <Button
              type="submit"
              className={cn("w-full bg-gradient-to-r from-[#8b5cf6] to-[#4f46e5] text-white")}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Masuk
            </Button>
          </form>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">atau</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <Button
            variant="secondary"
            className="w-full bg-white text-[#1b1145] hover:bg-white/90"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            Login dengan Google
          </Button>
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>Belum punya akun?</span>
            <Link href="/signup" className="inline-flex items-center gap-1 font-semibold text-emerald-200">
              Daftar sekarang <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
