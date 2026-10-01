import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { ensureMember, listClientsLite, listTags, loadAllTasks } from '@/lib/data/production';

/** Dados comuns das visões globais da Produção (lista, minhas tarefas, métricas, cliente). */
export async function loadGlobal(opts: { clientId?: string } = {}) {
  const user = await requireUser();
  const supabase = await createClient();
  const all = await loadAllTasks(supabase, opts);
  if (all.missing) return { missing: true as const };
  const [members, tags, clients] = await Promise.all([ensureMember(supabase, user), listTags(supabase), listClientsLite(supabase)]);
  const boards = Object.fromEntries(all.boards.map((b) => [b.id, b.name]));
  return { userId: user.id, ...all, boards, members, tags, clients, myMemberId: members.find((m) => m.user_id === user.id)?.id };
}
