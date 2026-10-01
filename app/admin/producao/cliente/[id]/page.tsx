import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClient } from '@/lib/data/clients';
import { loadGlobal } from '@/lib/data/production-global';
import { productionStats } from '@/lib/production/stats';
import { GlobalTasks } from '@/components/production/GlobalTasks';
import { ProdMigrationNotice, StatCards } from '@/components/production/ProductionChrome';

export const metadata = { title: 'Produção do cliente' };

export default async function ClientProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const g = await loadGlobal({ clientId: id });
  if (g.missing) return <div className="mx-auto max-w-3xl"><ProdMigrationNotice /></div>;
  const stats = productionStats(g.tasks, g.columns);
  const boardIds = [...new Set(g.tasks.map((t) => t.board_id))];
  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/admin/clients/${id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-6 mt-3">
        <p className="label mb-2 text-wine/70">Produção</p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">{client.company_name}</h1>
        <p className="mt-2 text-sm text-ink/60">Todas as tarefas deste cliente, de todos os quadros.</p>
      </header>
      <div className="mb-6"><StatCards s={stats} /></div>
      {boardIds.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="label text-wine/70">Abrir como quadro:</span>
          {boardIds.map((b) => <Link key={b} href={`/admin/producao/${b}?cliente=${id}`} className="rounded-full border border-wine/25 bg-white px-3.5 py-1.5 text-xs text-wine hover:bg-blush">{g.boards[b]}</Link>)}
        </div>
      )}
      <GlobalTasks ownerId={g.userId} mode="client" tasks={g.tasks} columns={g.columns} boards={g.boards} members={g.members} tags={g.tags} clients={g.clients} />
    </div>
  );
}
