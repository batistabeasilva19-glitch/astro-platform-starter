import Link from 'next/link';
import { Check, MessageSquare, PencilLine, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { fetchNotifications, lastSeen, type NotifKind } from '@/lib/data/notifications';
import { NotificationActions } from '@/components/admin/NotificationActions';
import { EmptyState } from '@/components/ui/Misc';
import { cn, fmtStamp } from '@/lib/utils';

export const metadata = { title: 'Notificações' };

const TABS: { id: string; label: string; kinds: NotifKind[] | null }[] = [
  { id: 'todas', label: 'Todas', kinds: null },
  { id: 'aprovacoes', label: 'Aprovações', kinds: ['approved'] },
  { id: 'alteracoes', label: 'Alterações pedidas', kinds: ['changes'] },
  { id: 'comentarios', label: 'Comentários', kinds: ['comment'] },
];
const STYLE: Record<NotifKind, { icon: typeof Check; chip: string; label: string }> = {
  approved: { icon: Check, chip: 'bg-emerald-100 text-emerald-700', label: 'Aprovou' },
  changes: { icon: PencilLine, chip: 'bg-red-100 text-red-700', label: 'Pediu alteração' },
  comment: { icon: MessageSquare, chip: 'bg-sky-100 text-sky-700', label: 'Comentou' },
  other: { icon: Sparkles, chip: 'bg-blush text-wine', label: 'Atividade' },
};

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await requireUser();
  const { tipo } = await searchParams;
  const tab = TABS.find((t) => t.id === tipo) ?? TABS[0];
  const supabase = await createClient();
  const [all, seen] = await Promise.all([fetchNotifications(supabase, 100), lastSeen()]);
  const list = tab.kinds ? all.filter((n) => tab.kinds!.includes(n.kind)) : all;
  const unread = all.filter((n) => n.at > seen).length;
  const count = (k: NotifKind[] | null) => (k ? all.filter((n) => k.includes(n.kind)) : all).filter((n) => n.at > seen).length;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="label mb-2 text-wine/70">Central</p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">Notificações</h1>
        <p className="mt-2 text-sm text-ink/60">Tudo que os clientes fazem: aprovações, pedidos de alteração e comentários, em conteúdos, calendário, stories e identidade visual.</p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {TABS.map((t) => {
            const n = count(t.kinds);
            return (
              <Link key={t.id} href={`/admin/notificacoes?tipo=${t.id}`} aria-current={t.id === tab.id ? 'page' : undefined} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition', t.id === tab.id ? 'border-wine bg-wine text-white' : 'border-wine/25 text-wine hover:bg-blush')}>
                {t.label}
                {n > 0 && <span className={cn('rounded-full px-1.5 text-[0.65rem] tabular-nums', t.id === tab.id ? 'bg-white text-wine' : 'bg-wine text-white')}>{n}</span>}
              </Link>
            );
          })}
        </nav>
        <NotificationActions unread={unread} />
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nenhuma notificação por aqui">Quando um cliente aprovar, pedir alteração ou comentar, aparece aqui na hora. ♡</EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {list.map((n) => {
            const st = STYLE[n.kind];
            const Icon = st.icon;
            const isNew = n.at > seen;
            return (
              <li key={n.id}>
                <Link href={n.href} className={cn('group card card-hover flex items-start gap-4 p-4', isNew && '!border-wine/40 bg-blush/40')}>
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', st.chip)}><Icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <strong className="font-medium text-wine">{n.client}</strong>
                      <span className="text-ink/55">· {st.label}</span>
                      {isNew && <span className="rounded-full bg-wine px-2 py-0.5 text-[0.62rem] uppercase tracking-wider text-white">novo</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink/80">{n.detail}</span>
                    <span className="mt-1 block truncate text-xs text-ink/45">{n.what} · {n.who} · <span title={fmtStamp(n.at)}>{ago(n.at)}</span></span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
