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
      <div className="shrink-0 border-b border-border bg-background px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-30" />
          <Skeleton className="h-8 w-24" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-5 w-18" />
            <Skeleton className="h-5 w-18" />
            <Skeleton className="h-5 w-18" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-80" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-36" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r border-border p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
        <div className="flex-1 min-w-0 p-3">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
        <div className="w-80 border-l border-border p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
