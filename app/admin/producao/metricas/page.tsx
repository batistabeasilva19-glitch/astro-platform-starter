import { loadGlobal } from '@/lib/data/production-global';
import { productionMetrics, productionStats } from '@/lib/production/stats';
import { HBars } from '@/components/perf/charts';
import { ProdMigrationNotice, ProductionNav, StatCards } from '@/components/production/ProductionChrome';
import { fmtDec } from '@/lib/perf/calc';

export const metadata = { title: 'Métricas · Produção' };

export default async function ProductionMetricsPage() {
  const g = await loadGlobal();
  if (g.missing) return <div className="mx-auto max-w-3xl"><ProdMigrationNotice /></div>;
  const stats = productionStats(g.tasks, g.columns);
  const m = productionMetrics(g.tasks, g.columns, g.clients);
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="label mb-2 text-wine/70">Produção</p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">Métricas de produção</h1>
        <p className="mt-2 text-sm text-ink/60">Indicadores internos — não são exibidos para clientes.</p>
      </header>
      <ProductionNav current="metricas" />
      <div className="mb-8"><StatCards s={stats} /></div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="card p-5"><p className="label text-wine/70">Tarefas concluídas no mês</p><p className="h-display mt-2 text-5xl text-wine">{m.doneMonth}</p></div>
        <div className="card p-5"><p className="label text-wine/70">Tempo médio entre criação e conclusão</p><p className="h-display mt-2 text-5xl text-wine">{m.avgDays == null ? '–' : `${fmtDec(m.avgDays)} dias`}</p><p className="mt-1 text-xs text-ink/45">Calculado só com tarefas já concluídas.</p></div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5"><h2 className="h-display mb-4 text-2xl text-wine">Demandas abertas por cliente</h2><HBars items={m.byClient} /></section>
        <section className="card p-5"><h2 className="h-display mb-4 text-2xl text-wine">Demandas abertas por categoria</h2><HBars items={m.byCategory} color="#c9707f" /></section>
      </div>
    </div>
  );
}
