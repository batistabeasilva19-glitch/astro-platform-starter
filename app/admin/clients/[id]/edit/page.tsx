import { notFound } from 'next/navigation';
import { getClient, requireUser } from '@/lib/data/clients';
import { ClientForm } from '@/components/admin/ClientForm';
import { DeleteClientButton } from '@/components/admin/ClientActions';
import { PageTitle } from '@/components/ui/Misc';

export const metadata = { title: 'Editar cliente' };

export default async function EditClient({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ next?: string }> }) {
  const { id } = await params;
  const next = (await searchParams).next;
  const user = await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Clientes" title={`Editar ${client.company_name}`} actions={<DeleteClientButton clientId={client.id} name={client.company_name} />} />
      <ClientForm ownerId={user.id} newId={client.id} client={client} next={next?.startsWith('/admin/identidades') ? next : undefined} />
    </div>
  );
}
