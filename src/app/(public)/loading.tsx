/** Shown while a storefront page renders on demand: the listing's shape, not a spinner. */
export default function StorefrontLoading() {
  return (
    <div className="animate-pulse pb-8 pt-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-40 rounded-sm bg-field" />
      <div className="mt-4 h-10 w-64 max-w-full rounded-sm bg-field" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] rounded-md bg-field" />
            <div className="mt-3 h-3 w-1/3 rounded-sm bg-field" />
            <div className="mt-2 h-4 w-3/4 rounded-sm bg-field" />
            <div className="mt-3 h-4 w-1/2 rounded-sm bg-field" />
          </div>
        ))}
      </div>
    </div>
  );
}
