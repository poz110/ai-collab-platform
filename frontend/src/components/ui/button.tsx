import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "destructive" | "outline" | "ghost" | "success";
type Size = "sm" | "md" | "icon";

const variantClass: Record<Variant, string> = {
  default: "bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-900",
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600",
  destructive: "bg-white text-red-600 border border-zinc-200 hover:bg-red-50 hover:border-red-200",
  outline: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50",
  ghost: "bg-transparent text-zinc-700 border border-transparent hover:bg-zinc-100",
  success: "bg-green-600 text-white hover:bg-green-700 border border-green-600",
};

const sizeClass: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs rounded-md",
  md: "h-9 px-3.5 text-sm rounded-lg",
  icon: "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
