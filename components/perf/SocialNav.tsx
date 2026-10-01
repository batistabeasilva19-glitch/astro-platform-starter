import Link from 'next/link';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'conteudo', label: 'Conteúdo', href: (id: string) => `/admin/clients/${id}?view=list` },
  { id: 'calendario', label: 'Calendário', href: (id: string) => `/admin/clients/${id}?view=calendar` },
  { id: 'feed', label: 'Feed', href: (id: string) => `/admin/clients/${id}?view=feed` },
  { id: 'estrategia', label: 'Estratégia', href: (id: string) => `/admin/clients/${id}/estrategia` },
  { id: 'desempenho', label: 'Desempenho', href: (id: string) => `/admin/clients/${id}/desempenho` },
  { id: 'relatorios', label: 'Relatórios', href: (id: string) => `/admin/clients/${id}/relatorios` },
] as const;

/** Faixa "Redes sociais" do cliente: Conteúdo · Calendário · Feed · Estratégia · Desempenho · Relatórios. */
export function SocialNav({ clientId, current }: { clientId: string; current: (typeof ITEMS)[number]['id'] }) {
  return (
    <nav aria-label="Redes sociais" className="no-scrollbar -mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
      <span className="label mr-2 hidden shrink-0 self-center text-wine/50 sm:block">Redes sociais</span>
      {ITEMS.map((i) => (
        <Link key={i.id} href={i.href(clientId)} aria-current={current === i.id ? 'page' : undefined} className={cn('shrink-0 rounded-full border px-4 py-2 text-[0.8rem] transition', current === i.id ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function MigrationNotice() {
  return (
    <div className="card border-dashed p-8 text-center">
      <p className="h-display text-2xl text-wine">Falta um passo no Supabase</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">Rode a migration <code className="rounded bg-blush px-1.5 py-0.5">supabase/migrations/0008_desempenho.sql</code> no SQL Editor do Supabase e recarregue esta página.</p>
    </div>
  );
}
