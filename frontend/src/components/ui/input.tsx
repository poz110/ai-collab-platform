import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900",
      "placeholder:text-zinc-400",
      "focus:border-transparent focus:outline-2 focus:outline-indigo-500",
      "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
