"use client";

import { useToastStore } from "@/stores/toast";
import { cn } from "@/lib/utils";

/** 全局 Toast 容器（对齐原型：底部居中黑底白字） */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[99] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg px-4 py-2.5 text-[13px] text-white shadow-lg",
            t.kind === "error" ? "bg-red-600" : t.kind === "success" ? "bg-green-600" : "bg-zinc-900",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
