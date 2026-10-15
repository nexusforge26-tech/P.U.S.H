export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="animate-pulse space-y-8">
        <div className="h-36 rounded-[32px] bg-olive/10" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex h-72 flex-col overflow-hidden rounded-[26px] border border-olive/10 bg-white p-4 shadow-card"
            >
              <div className="h-36 w-full rounded-2xl bg-olive/10" />
              <div className="mt-4 h-4 w-1/3 rounded-full bg-olive/10" />
              <div className="mt-3 h-5 w-4/5 rounded-full bg-olive/15" />
              <div className="mt-2 h-4 w-2/3 rounded-full bg-olive/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
