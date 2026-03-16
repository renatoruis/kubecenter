type BadgeVariant = "healthy" | "degraded" | "scaled-down" | "default" | "success" | "warning" | "error";

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  healthy:   { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500 shadow-sm shadow-emerald-500/50" },
  success:   { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500 shadow-sm shadow-emerald-500/50" },
  degraded:  { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-500 shadow-sm shadow-amber-500/50" },
  warning:   { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-500 shadow-sm shadow-amber-500/50" },
  error:     { bg: "bg-red-500/10",     text: "text-red-400",     dot: "bg-red-500 shadow-sm shadow-red-500/50" },
  "scaled-down": { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" },
  default:   { bg: "bg-slate-500/10",  text: "text-slate-400",   dot: "bg-slate-400" },
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = "default", dot = false, className = "" }: BadgeProps) {
  const s = variantStyles[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />}
      {children}
    </span>
  );
}
