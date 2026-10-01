import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { loadBoard } from '@/lib/data/production';
import { BoardView, type ActivityRow, type SavedFilter } from '@/components/production/BoardView';
import type { RecurrenceRow } from '@/components/production/BoardSettingsModal';
import { ProdMigrationNotice } from '@/components/production/ProductionChrome';

export const metadata = { title: 'Quadro · Produção' };

export default async function BoardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ arquivadas?: string; cliente?: string; card?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const data = await loadBoard(supabase, user, id, { archived: sp.arquivadas === '1' });
  if (data.missing) return <div className="mx-auto max-w-3xl"><ProdMigrationNotice /></div>;
  if (!data.board) notFound();
  const [filters, recs, activity] = await Promise.all([
    supabase.from('prod_saved_filters').select('id, name, filter').eq('owner_id', user.id).or(`board_id.is.null,board_id.eq.${id}`).order('created_at'),
    supabase.from('prod_recurrences').select('*').eq('board_id', id).order('created_at'),
    supabase.from('prod_activity').select('id, task_id, actor_name, detail, created_at').eq('board_id', id).order('created_at', { ascending: false }).limit(120),
  ]);
  return (
    <div className="mx-auto max-w-[110rem]">
      <BoardView
        ownerId={user.id}
        board={data.board}
        columns={data.columns}
        tasks={data.tasks}
        members={data.members}
        tags={data.tags}
        clients={data.clients}
        recurrences={(recs.data ?? []) as RecurrenceRow[]}
        savedFilters={(filters.data ?? []) as SavedFilter[]}
        activity={(activity.data ?? []) as ActivityRow[]}
        showArchived={sp.arquivadas === '1'}
        initialFilters={sp.cliente ? { client: sp.cliente } : undefined}
        initialOpenTask={sp.card}
      />
    </div>
  );
}
