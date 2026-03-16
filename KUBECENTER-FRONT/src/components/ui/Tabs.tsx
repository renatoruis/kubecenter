"use client";

import type { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  return (
    <div className="border-b border-[var(--border)] overflow-x-auto">
      <div className="flex gap-6 min-w-max">
        {tabs.map((tab) => {
          const active = activeId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 border-b-2 pb-3 px-1 text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
              {tab.label}
              {tab.count != null && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                  active
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "bg-slate-800 text-[var(--text-muted)]"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
