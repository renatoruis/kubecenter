import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  interactive?: boolean;
  className?: string;
}

export function Card({
  children,
  title,
  icon,
  actions,
  interactive = false,
  className = "",
}: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] ${
        interactive ? "cursor-pointer hover:shadow-[var(--shadow-md)] hover:border-[var(--accent)]" : ""
      } ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="text-[var(--text-muted)]">{icon}</span>
            )}
            {title && (
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
