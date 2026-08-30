export default function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-8"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading workspace</span>
      <div className="bg-muted h-4 w-28 animate-pulse rounded-full" />
      <div className="bg-muted mt-5 h-10 max-w-lg animate-pulse rounded-xl" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="border-border bg-card h-36 animate-pulse rounded-2xl border"
          />
        ))}
      </div>
    </div>
  );
}
