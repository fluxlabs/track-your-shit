// Track Your Shit - Badge Component
// Enhanced with brand colors and status variants
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline:
          "text-foreground border-border",
        // Brand variants
        brand:
          "border-transparent bg-gradient-to-r from-brand-blue to-brand-purple text-white shadow-md shadow-brand-blue/30",
        // Status variants (using design tokens)
        success:
          "border-status-success/30 bg-status-success/10 text-status-success",
        warning:
          "border-status-warning/30 bg-status-warning/10 text-status-warning",
        error:
          "border-status-error/30 bg-status-error/10 text-status-error",
        info:
          "border-status-info/30 bg-status-info/10 text-status-info",
        pending:
          "border-status-pending/30 bg-status-pending/10 text-status-pending",
        // Subtle variants (muted backgrounds)
        "subtle-blue":
          "border-brand-blue/20 bg-brand-blue/10 text-brand-blue",
        "subtle-purple":
          "border-brand-purple/20 bg-brand-purple/10 text-brand-purple",
        "subtle-cyan":
          "border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-1.5 py-0 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
