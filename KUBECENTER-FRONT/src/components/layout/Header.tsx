"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Circle } from "lucide-react";

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];

  const labelMap: Record<string, string> = {
    applications: "Aplicações",
  };

  if (segments.length === 0) {
    return [{ label: "Dashboard" }];
  }

  let path = "";
  segments.forEach((seg, i) => {
    path += `/${seg}`;
    const isLast = i === segments.length - 1;
    crumbs.push({
      label: labelMap[seg] ?? decodeURIComponent(seg),
      href: isLast ? undefined : path,
    });
  });

  return crumbs;
}

export function Header() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-800 bg-[var(--bg)] px-6">
      <nav className="flex shrink-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="font-medium text-[var(--text-muted)] hover:text-[var(--accent)]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-bold text-[var(--text-primary)]">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-muted)]">
        <Circle className="h-2 w-2 fill-[var(--success)] text-[var(--success)]" />
        <span>Conectado</span>
      </div>
    </header>
  );
}
