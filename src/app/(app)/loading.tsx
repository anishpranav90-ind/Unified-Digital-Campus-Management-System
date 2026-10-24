export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-64 rounded-lg bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 rounded-2xl border border-line bg-white lg:col-span-2" />
        <div className="h-80 rounded-2xl border border-line bg-white" />
      </div>
    </div>
  );
}
