import { cn } from "@/lib/utils";

export function ProgressBar({ value = 0, label = "Memproses", className }) {
  const clamped = Math.min(Math.max(Math.round(value ?? 0), 0), 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/60">
        <span>{label}</span>
        <span className="font-semibold text-white/80">
          {clamped}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#22d3ee] to-[#4f46e5] shadow-[0_0_18px_rgba(124,92,255,0.45)] transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
