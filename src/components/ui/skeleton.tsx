// Track Your Shit - Skeleton Component
// Loading state placeholders with shimmer animation
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/** Pre-computed widths for skeleton text lines to avoid impure Math.random in render */
const SKELETON_LINE_WIDTHS = [82, 65, 91, 74, 58, 87, 70, 95, 63, 78];

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton for card content
 */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 space-y-4", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/**
 * Skeleton for project list item
 */
function SkeletonProjectItem({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 rounded-lg border space-y-2.5", className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-1/3" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-2/3 ml-6" />
      <div className="flex gap-2 ml-6">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
        <Skeleton className="h-5 w-24 rounded" />
      </div>
      <div className="flex items-center gap-2 ml-6">
        <Skeleton className="h-1 w-32 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-14 rounded ml-auto" />
      </div>
    </div>
  );
}

/**
 * Skeleton for stats card
 */
function SkeletonStatsCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="p-6 pb-2 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="p-6 pt-0 space-y-1">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * Skeleton for activity item
 */
function SkeletonActivityItem({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Skeleton className="h-4 w-4 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for table row
 */
function SkeletonTableRow({ columns = 4, className }: { columns?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 p-4 border-b", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-1/4" : i === columns - 1 ? "w-16" : "w-1/6"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for terminal/text block
 */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${SKELETON_LINE_WIDTHS[i % SKELETON_LINE_WIDTHS.length]}%` }}
        />
      ))}
    </div>
  );
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonProjectItem,
  SkeletonStatsCard,
  SkeletonActivityItem,
  SkeletonTableRow,
  SkeletonText,
};
