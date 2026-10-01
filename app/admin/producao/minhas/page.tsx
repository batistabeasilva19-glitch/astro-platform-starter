import { loadGlobal } from '@/lib/data/production-global';
import { GlobalTasks } from '@/components/production/GlobalTasks';
import { ProdMigrationNotice, ProductionNav } from '@/components/production/ProductionChrome';

export const metadata = { title: 'Minhas tarefas · Produção' };

export default async function MyTasksPage() {
  const g = await loadGlobal();
  if (g.missing) return <div className="mx-auto max-w-3xl"><ProdMigrationNotice /></div>;
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="label mb-2 text-wine/70">Produção</p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">Minhas tarefas</h1>
        <p className="mt-2 text-sm text-ink/60">Tudo que está atribuído a você, separado em atrasadas, hoje, próximas, sem prazo e concluídas — e a visão da sua semana.</p>
      </header>
      <ProductionNav current="minhas" />
      <GlobalTasks ownerId={g.userId} mode="mine" tasks={g.tasks} columns={g.columns} boards={g.boards} members={g.members} tags={g.tags} clients={g.clients} myMemberId={g.myMemberId} />
    </div>
  );
}
