/** Feedback imediato ao navegar no painel (enquanto a página carrega do servidor). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" role="status" aria-label="Carregando">
      <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-blush"><div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] rounded-full bg-wine" /></div>
      <div className="mb-3 h-3 w-28 rounded-full bg-wine/15" />
      <div className="mb-8 h-10 w-2/3 max-w-md rounded-2xl bg-wine/10" />
      <div className="space-y-4">
        <div className="h-28 rounded-3xl bg-white/70" />
        <div className="h-28 rounded-3xl bg-white/70" />
        <div className="h-28 rounded-3xl bg-white/70" />
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}
