import { listClients } from '@/lib/data/clients';
import { ProjectForm } from '@/components/identity/ProjectForm';
import { EmptyState, PageTitle } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';

export const metadata = { title: 'Nova identidade visual' };

export default async function NewIdentity({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const sp = await searchParams;
  const clients = await listClients();
  const clientId = clients.some((c) => c.id === sp.client) ? sp.client : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Identidades visuais" title="Nova identidade visual" />
      {clients.length === 0 ? (
        <EmptyState title="Cadastre um cliente primeiro">
          <div className="mt-3">
            <LinkButton href="/admin/clients/new?next=/admin/identidades/new">Novo cliente</LinkButton>
          </div>
        </EmptyState>
      ) : (
        <div className="card p-6 sm:p-8">
          <ProjectForm clients={clients.map((c) => ({ id: c.id, company_name: c.company_name }))} clientId={clientId} />
        </div>
      )}
    </div>
  );
}
