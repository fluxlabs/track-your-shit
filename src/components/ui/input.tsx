// Track Your Shit - Input Component
// Enhanced with improved focus states and styling
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm",
          "shadow-sm backdrop-blur-sm transition-all duration-200",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:border-brand-blue",
          "hover:border-input/80 hover:bg-background/70",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
