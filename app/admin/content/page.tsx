import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@/lib/data/clients';
import { fetchCards } from '@/lib/data/content';
import { FORMATS, FORMAT_META, STATUSES, STATUS_META } from '@/lib/constants';
import { ContentCard } from '@/components/content/ContentCard';
import { EmptyState, PageTitle } from '@/components/ui/Misc';
import { Button, LinkButton, buttonClass } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Fields';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Conteúdos' };

type SP = { client?: string; format?: string; status?: string; from?: string; to?: string };

const QUICK: { label: string; status: string }[] = [
  { label: 'Aguardando aprovação', status: 'pending_approval,revised_pending' },
  { label: 'Aprovados', status: 'approved' },
  { label: 'Alteração solicitada', status: 'changes_requested' },
  { label: 'Programados', status: 'scheduled' },
  { label: 'Publicados', status: 'published' },
];

export default async function ContentList({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const clients = await listClients();
  const supabase = await createClient();
  const statuses = sp.status?.split(',').filter((s) => (STATUSES as string[]).includes(s));
  const items = await fetchCards(supabase, {
    clientId: sp.client || undefined,
    formats: sp.format ? [sp.format] : undefined,
    statuses,
    from: sp.from || undefined,
    to: sp.to || undefined,
  });
  const name = new Map(clients.map((c) => [c.id, c.company_name]));
  const qs = (status?: string) => {
    const p = new URLSearchParams();
    if (sp.client) p.set('client', sp.client);
    if (sp.format) p.set('format', sp.format);
    if (sp.from) p.set('from', sp.from);
    if (sp.to) p.set('to', sp.to);
    if (status) p.set('status', status);
    return `/admin/content?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle eyebrow="Todos os clientes" title="Conteúdos" actions={<LinkButton href="/admin/content/new">Novo conteúdo</LinkButton>} />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={qs()} className={cn('rounded-full border px-4 py-1.5 text-xs transition', !sp.status ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>Todos</Link>
        {QUICK.map((q) => (
          <Link key={q.status} href={qs(q.status)} className={cn('rounded-full border px-4 py-1.5 text-xs transition', sp.status === q.status ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>
            {q.label}
          </Link>
        ))}
      </div>

      <form className="card mb-8 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6" method="GET">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <Field label="Cliente" className="lg:col-span-2">
          <Select name="client" defaultValue={sp.client ?? ''}>
            <option value="">Todos</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </Select>
        </Field>
        <Field label="Formato">
          <Select name="format" defaultValue={sp.format ?? ''}>
            <option value="">Todos</option>
            {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_META[f].label}</option>)}
          </Select>
        </Field>
        <Field label="De"><Input type="date" name="from" defaultValue={sp.from} /></Field>
        <Field label="Até"><Input type="date" name="to" defaultValue={sp.to} /></Field>
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">Filtrar</Button>
          <Link href="/admin/content" className={buttonClass('ghost', 'md')}>Limpar</Link>
        </div>
      </form>

      <p className="mb-4 text-sm text-ink/60">
        {items.length} {items.length === 1 ? 'conteúdo' : 'conteúdos'}
        {statuses?.length ? ` · ${statuses.map((s) => STATUS_META[s as keyof typeof STATUS_META].label).join(' / ')}` : ''}
      </p>
      {items.length === 0 ? (
        <EmptyState title="Nada por aqui">Ajuste os filtros para ver outros conteúdos.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((i) => (
            <ContentCard key={i.id} item={i} href={`/admin/content/${i.id}`} clientName={name.get(i.client_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
