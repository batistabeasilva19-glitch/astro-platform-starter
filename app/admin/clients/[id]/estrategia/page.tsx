import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { listStrategyDocs } from '@/lib/data/strategy';
import { StrategyManager } from '@/components/strategy/StrategyManager';
import { Avatar } from '@/components/ui/Misc';

export const metadata = { title: 'Estratégia de rede' };

export default async function StrategyAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const supabase = await createClient();
  const { docs, missing } = await listStrategyDocs(supabase, id);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-8 mt-4 flex items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div>
          <p className="label mb-1 text-wine/70">Social Mídia</p>
          <h1 className="h-display text-3xl text-wine sm:text-4xl">Estratégia de rede</h1>
          <p className="mt-1 text-sm text-ink/60">PDFs de estratégia de {client.company_name}, separados por mês. O cliente acessa pelo link de aprovação e pesquisa por mês.</p>
        </div>
      </header>

      {missing ? (
        <div className="card border-dashed p-8 text-center">
          <p className="h-display text-2xl text-wine">Falta um passo no Supabase</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">Rode a migration <code className="rounded bg-blush px-1.5 py-0.5">supabase/migrations/0006_estrategia.sql</code> no SQL Editor do Supabase e recarregue esta página.</p>
        </div>
      ) : (
        <StrategyManager ownerId={user.id} clientId={id} docs={docs} />
      )}
    </div>
  );
}
