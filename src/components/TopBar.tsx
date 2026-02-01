export default function TopBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 backdrop-blur">
          <div className="text-sm font-semibold">TravelEx</div>
        </div>
      </div>
    </div>
  );
}
