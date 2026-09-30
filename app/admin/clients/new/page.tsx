import { randomUUID } from 'crypto';
import { requireUser } from '@/lib/data/clients';
import { ClientForm } from '@/components/admin/ClientForm';
import { PageTitle } from '@/components/ui/Misc';

export const metadata = { title: 'Novo cliente' };

export default async function NewClient() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Clientes" title="Novo cliente" />
      <ClientForm ownerId={user.id} newId={randomUUID()} />
    </div>
  );
}
