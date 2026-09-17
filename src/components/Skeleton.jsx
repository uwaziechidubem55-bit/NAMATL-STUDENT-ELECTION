export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-300 dark:bg-gray-700 ${className}`}
    />
  );
}

// Reusable card skeleton (e.g., for candidate/voter lists)
export function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  );
}

export default Skeleton;