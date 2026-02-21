// Track Your Shit - Progress Component
// Enhanced with gradient and glow effects
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full",
  {
    variants: {
      variant: {
        default: "bg-primary/20",
        brand: "bg-brand-blue/20",
        success: "bg-status-success/20",
        warning: "bg-status-warning/20",
        error: "bg-status-error/20",
      },
      size: {
        sm: "h-1",
        default: "h-2",
        lg: "h-3",
        xl: "h-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-500 ease-out",
  {
    variants: {
      variant: {
        default: "bg-primary",
        brand: "bg-gradient-to-r from-brand-blue via-brand-purple to-brand-blue bg-size-200 shadow-lg shadow-brand-blue/50",
        success: "bg-status-success",
        warning: "bg-status-warning",
        error: "bg-status-error",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant, size, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(progressVariants({ variant, size }), className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(indicatorVariants({ variant }), indicatorClassName)}
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        backgroundPosition: `${(value || 0)}% 0`,
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress, progressVariants };
