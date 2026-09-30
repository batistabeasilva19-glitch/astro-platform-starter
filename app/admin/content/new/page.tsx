import { notFound } from 'next/navigation';
import { listClients } from '@/lib/data/clients';
import { ContentForm } from '@/components/admin/ContentForm';
import { EmptyState, PageTitle } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';

export const metadata = { title: 'Novo conteúdo' };

export default async function NewContent({ searchParams }: { searchParams: Promise<{ client?: string; date?: string }> }) {
  const sp = await searchParams;
  const clients = await listClients();
  if (!clients.length) {
    return (
      <EmptyState title="Cadastre um cliente primeiro">
        <LinkButton href="/admin/clients/new">Novo cliente</LinkButton>
      </EmptyState>
    );
  }
  const clientId = sp.client && clients.some((c) => c.id === sp.client) ? sp.client : clients[0].id;
  if (!clientId) notFound();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Conteúdo" title="Novo conteúdo" />
      <div className="card p-6 sm:p-8">
        <ContentForm clients={clients.map((c) => ({ id: c.id, company_name: c.company_name }))} clientId={clientId} defaultDate={date} />
      </div>
    </div>
  );
}
