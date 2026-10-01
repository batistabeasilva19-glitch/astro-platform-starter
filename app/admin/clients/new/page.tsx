import { randomUUID } from 'crypto';
import { requireUser } from '@/lib/data/clients';
import { ClientForm } from '@/components/admin/ClientForm';
import { PageTitle } from '@/components/ui/Misc';

export const metadata = { title: 'Novo cliente' };

export default async function NewClient({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser();
  const next = (await searchParams).next;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Clientes" title="Novo cliente" />
      <ClientForm ownerId={user.id} newId={randomUUID()} next={next?.startsWith('/admin/identidades') ? next : undefined} />
    </div>
  );
}
