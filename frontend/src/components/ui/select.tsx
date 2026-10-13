"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 轻量 Select（原生外观 + 自定义下拉面板）。
 * 受控：value / onValueChange；options 传入。
 */
export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "请选择",
  className,
  disabled,
  clearable,
  clearLabel = "清除选择",
}: {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm",
          "focus:outline-2 focus:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
          current ? "text-zinc-900" : "text-zinc-400",
        )}
      >
        <span className="truncate">{current ? current.label : placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {clearable && value !== null ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-50"
              onClick={() => {
                onValueChange(null);
                setOpen(false);
              }}
            >
              {clearLabel}
            </button>
          ) : null}
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-400">暂无选项</div>
          ) : (
            options.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50",
                  o.value === value ? "font-medium text-indigo-600" : "text-zinc-700",
                  o.disabled && "cursor-not-allowed opacity-50",
                )}
                onClick={() => {
                  onValueChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {o.value === value ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
