import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
      "placeholder:text-zinc-400",
      "focus:border-transparent focus:outline-2 focus:outline-indigo-500",
      "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
