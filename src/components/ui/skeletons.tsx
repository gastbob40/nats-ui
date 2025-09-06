import { Skeleton } from "./skeleton";

// Skeleton for metric cards (Dashboard)
export function MetricCardSkeleton() {
  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// Skeleton for table rows
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// Skeleton for message list
export function MessageSkeleton() {
  return (
    <div className="p-4 space-y-3 border-b">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="flex items-center space-x-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// Skeleton for topic list
export function TopicSkeleton() {
  return (
    <div className="p-3 space-y-2 border-b">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-8" />
      </div>
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// Skeleton for stream cards
export function StreamCardSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

// Generic row skeleton (not for tables)
export function RowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center space-x-4 p-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}

// Generic loading skeleton for full page
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}