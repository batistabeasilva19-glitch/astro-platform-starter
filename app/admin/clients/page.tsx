import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@/lib/data/clients';
import { DemoButton } from '@/components/admin/DemoButton';
import { Avatar, EmptyState, PageTitle } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';
import { AWAITING } from '@/lib/constants';

export const metadata = { title: 'Clientes' };

export default async function ClientsPage() {
  const clients = await listClients();
  const supabase = await createClient();
  const { data: items } = await supabase.from('content_items').select('client_id, status');
  const stat = (id: string) => {
    const mine = (items ?? []).filter((i) => i.client_id === id);
    return {
      total: mine.length,
      awaiting: mine.filter((i) => AWAITING.includes(i.status)).length,
      changes: mine.filter((i) => i.status === 'changes_requested').length,
    };
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        eyebrow="Projetos"
        title="Clientes"
        actions={
          <LinkButton href="/admin/clients/new">
            <Plus className="size-4" /> Novo cliente
          </LinkButton>
        }
      />
      {clients.length === 0 ? (
        <EmptyState title="Nenhum cliente ainda">
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <LinkButton href="/admin/clients/new">Cadastrar cliente</LinkButton>
            <DemoButton />
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c, i) => {
            const s = stat(c.id);
            return (
              <Link key={c.id} href={`/admin/clients/${c.id}`} style={{ animationDelay: `${i * 50}ms` }} className="card card-hover animate-rise block p-6">
                <div className="flex items-center gap-4">
                  <Avatar name={c.company_name} src={c.avatar_url} className="size-16 text-lg" />
                  <div className="min-w-0">
                    <h2 className="h-display truncate text-2xl text-wine">{c.company_name}</h2>
                    <p className="truncate text-sm text-ink/60">@{c.instagram_handle || '—'}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-ink/60">Responsável: {c.contact_name || '—'}</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-blush px-3 py-1 text-wine">{s.total} conteúdos</span>
                  {s.awaiting > 0 && <span className="rounded-full border border-wine/30 px-3 py-1 text-wine">{s.awaiting} aguardando</span>}
                  {s.changes > 0 && <span className="rounded-full bg-wine px-3 py-1 text-white">{s.changes} p/ alterar</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
