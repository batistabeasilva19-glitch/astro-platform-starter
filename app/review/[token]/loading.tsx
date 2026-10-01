export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Carregando">
      <div className="mb-8 h-40 rounded-[2rem] bg-blush" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/5] rounded-3xl bg-white/70" />)}
      </div>
    </div>
  );
}
