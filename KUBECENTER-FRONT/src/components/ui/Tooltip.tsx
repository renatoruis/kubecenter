"use client";

import { useState, type ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--text-primary)] px-2.5 py-1.5 text-xs text-[var(--text-inverse)] shadow-[var(--shadow-md)] animate-fade-in pointer-events-none">
          {content}
        </span>
      )}
    </span>
  );
}
