import { loadGlobal } from '@/lib/data/production-global';
import { GlobalTasks } from '@/components/production/GlobalTasks';
import { ProdMigrationNotice, ProductionNav } from '@/components/production/ProductionChrome';

export const metadata = { title: 'Todas as tarefas · Produção' };

export default async function AllTasksPage() {
  const g = await loadGlobal();
  if (g.missing) return <div className="mx-auto max-w-3xl"><ProdMigrationNotice /></div>;
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="label mb-2 text-wine/70">Produção</p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">Todas as tarefas</h1>
        <p className="mt-2 text-sm text-ink/60">Lista de todos os quadros juntos. Filtre, ordene e agrupe por cliente, responsável, categoria, status, prioridade ou prazo.</p>
      </header>
      <ProductionNav current="tarefas" />
      <GlobalTasks ownerId={g.userId} mode="all" tasks={g.tasks} columns={g.columns} boards={g.boards} members={g.members} tags={g.tags} clients={g.clients} />
    </div>
  );
}
