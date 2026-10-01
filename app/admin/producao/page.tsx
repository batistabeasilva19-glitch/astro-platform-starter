import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { ensureMember, listClientsLite, loadAllTasks } from '@/lib/data/production';
import { productionStats } from '@/lib/production/stats';
import { DONE_KINDS } from '@/lib/production/types';
import { todayBR } from '@/lib/perf/calc';
import { BoardsHome, type BoardCard } from '@/components/production/BoardsHome';
import { ProdMigrationNotice, ProductionNav, StatCards } from '@/components/production/ProductionChrome';

export const metadata = { title: 'Produção' };

export default async function ProductionHome() {
  const user = await requireUser();
  const supabase = await createClient();
  const all = await loadAllTasks(supabase);
  if (all.missing) {
    return (
      <div className="mx-auto max-w-3xl">
        <ProdMigrationNotice />
      </div>
    );
  }
  await ensureMember(supabase, user);
  const [{ data: boardRows }, clients] = await Promise.all([supabase.from('prod_boards').select('id, name, description, favorite, archived, client_id').order('created_at'), listClientsLite(supabase)]);
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const kind = new Map(all.columns.map((c) => [c.id, c.kind]));
  const today = todayBR();
  const boards: BoardCard[] = (boardRows ?? []).map((b) => {
    const ts = all.tasks.filter((t) => t.board_id === b.id);
    const done = ts.filter((t) => DONE_KINDS.includes(kind.get(t.column_id) ?? 'custom'));
    return { id: b.id as string, name: b.name as string, description: b.description as string, favorite: !!b.favorite, archived: !!b.archived, client_name: b.client_id ? (names.get(b.client_id as string) ?? null) : null, open: ts.length - done.length, overdue: ts.filter((t) => t.due_date && t.due_date < today && !DONE_KINDS.includes(kind.get(t.column_id) ?? 'custom')).length, done: done.length };
  });
  const stats = productionStats(all.tasks, all.columns);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="label mb-2 text-wine/70">Organização interna</p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">Produção</h1>
        <p className="mt-2 text-sm text-ink/60">Organize tarefas, conteúdos e entregas em um só lugar. Esta área é interna: o cliente nunca vê.</p>
      </header>
      <ProductionNav current="quadros" />
      <div className="mb-10"><StatCards s={stats} /></div>
      <BoardsHome boards={boards} clients={clients} />
      <p className="mt-10 text-center text-xs text-ink/40">Quer ver um cliente só? Abra <Link href="/admin/clients" className="underline">Clientes</Link> → cliente → “Ver quadro do cliente”.</p>
    </div>
  );
}
