import type { ReactNode } from "react";

type StatColor = "blue" | "green" | "amber" | "red" | "slate";

const colorMap: Record<StatColor, { bg: string; icon: string; bar: string }> = {
  blue:  { bg: "bg-blue-500/10",    icon: "text-blue-400",    bar: "bg-blue-500" },
  green: { bg: "bg-emerald-500/10", icon: "text-emerald-400", bar: "bg-emerald-500" },
  amber: { bg: "bg-amber-500/10",   icon: "text-amber-400",   bar: "bg-amber-500" },
  red:   { bg: "bg-red-500/10",     icon: "text-red-400",     bar: "bg-red-500" },
  slate: { bg: "bg-slate-500/10",   icon: "text-slate-400",   bar: "bg-slate-500" },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: StatColor;
  subtitle?: ReactNode;
  progress?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  color = "blue",
  subtitle,
  progress,
  className = "",
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={`flex flex-col gap-1 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] p-5 hover:border-slate-700 ${className}`}
    >
      <div className="flex justify-between items-start">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <span className={c.icon}>{icon}</span>
        )}
      </div>
      <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums leading-none mt-1">
        {value}
      </p>
      {progress != null && (
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div className={`${c.bar} h-full rounded-full`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      {subtitle && (
        <div className="mt-1.5 text-sm text-[var(--text-muted)]">{subtitle}</div>
      )}
    </div>
  );
}
