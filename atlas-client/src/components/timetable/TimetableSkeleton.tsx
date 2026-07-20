import { Skeleton } from '@/ui/skeleton';
import { motion } from 'motion/react';

export function TimetableSkeleton() {
  return (
    <motion.div
      className="flex flex-col h-[calc(100svh-3.5rem)]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0 }}
    >
      <div className="h-0.5 shrink-0 bg-emerald-500 animate-pulse" />
      <div className="shrink-0 border-b border-border bg-muted/20 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-40 bg-muted/80" />
          <Skeleton className="h-8 w-30 bg-muted/80" />
          <Skeleton className="h-8 w-24 bg-muted/80" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-5 w-18 bg-muted/80" />
            <Skeleton className="h-5 w-18 bg-muted/80" />
            <Skeleton className="h-5 w-18 bg-muted/80" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Loading timetable:</span> finding the latest run first, then adding labels and secondary diagnostics after the grid is ready.
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-32 bg-muted/80" />
          <Skeleton className="h-7 w-80 bg-muted/80" />
          <Skeleton className="h-7 w-36 bg-muted/80" />
          <Skeleton className="h-7 w-36 bg-muted/80" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r border-border bg-muted/15 p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full bg-muted/80" />
          ))}
        </div>
        <div className="flex-1 min-w-0 bg-muted/10 p-3">
          <Skeleton className="h-full w-full rounded-lg bg-muted/80" />
        </div>
        <div className="w-80 border-l border-border bg-muted/15 p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full bg-muted/80" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
