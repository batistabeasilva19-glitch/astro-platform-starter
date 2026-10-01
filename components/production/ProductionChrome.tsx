import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ProductionStats } from '@/lib/production/stats';

const TABS = [
  { id: 'quadros', label: 'Quadros', href: '/admin/producao' },
  { id: 'tarefas', label: 'Todas as tarefas', href: '/admin/producao/tarefas' },
  { id: 'minhas', label: 'Minhas tarefas', href: '/admin/producao/minhas' },
  { id: 'metricas', label: 'Métricas', href: '/admin/producao/metricas' },
] as const;

/** Faixa de navegação da área Produção. */
export function ProductionNav({ current }: { current: (typeof TABS)[number]['id'] }) {
  return (
    <nav aria-label="Produção" className="no-scrollbar -mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1">
      {TABS.map((t) => (
        <Link key={t.id} href={t.href} aria-current={current === t.id ? 'page' : undefined} className={cn('shrink-0 rounded-full border px-4 py-2 text-[0.8rem] transition', current === t.id ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>{t.label}</Link>
      ))}
    </nav>
  );
}

export function ProdMigrationNotice() {
  return (
    <div className="card border-dashed p-8 text-center">
      <p className="h-display text-2xl text-wine">Falta um passo no Supabase</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">Rode a migration <code className="rounded bg-blush px-1.5 py-0.5">supabase/migrations/0011_producao.sql</code> no SQL Editor do Supabase e recarregue esta página.</p>
    </div>
  );
}

/** Cartões do dashboard de produção. */
export function StatCards({ s }: { s: ProductionStats }) {
  const items: [string, number, boolean?][] = [
    ['Tarefas abertas', s.open],
    ['Em produção', s.production],
    ['Aguardando cliente', s.awaiting],
    ['Alterações', s.changes, s.changes > 0],
    ['Atrasadas', s.overdue, s.overdue > 0],
    ['Concluídas no mês', s.doneMonth],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {items.map(([label, n, hi]) => (
        <div key={label} className={cn('card p-4', hi && '!border-wine !bg-wine text-white')}>
          <p className={cn('label', hi ? 'text-white/80' : 'text-wine/70')}>{label}</p>
          <p className={cn('h-display mt-2 text-4xl', hi ? 'text-white' : 'text-wine')}>{n}</p>
        </div>
      ))}
    </div>
  );
}
