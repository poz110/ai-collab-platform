"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** 受控 Tabs（原型风格：灰底胶囊容器 + 白色激活项） */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  items: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5",
        className,
      )}
      role="tablist"
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onValueChange(it.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] transition-colors",
            value === it.value
              ? "bg-white font-semibold text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
