import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { listReports } from '@/lib/data/perf';
import { monthLabel } from '@/lib/perf/calc';
import { REPORT_STATUS_LABEL } from '@/lib/perf/types';
import { Avatar } from '@/components/ui/Misc';
import { SocialNav, MigrationNotice } from '@/components/perf/SocialNav';
import { CreateReport } from '@/components/perf/CreateReport';
import { cn, fmtStamp } from '@/lib/utils';

export const metadata = { title: 'Relatórios' };

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const supabase = await createClient();
  const { reports, missing } = await listReports(supabase, id);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-6 mt-4 flex items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div>
          <p className="label mb-1 text-wine/70">Redes sociais</p>
          <h1 className="h-display text-3xl text-wine sm:text-4xl">Relatórios</h1>
          <p className="mt-1 text-sm text-ink/60">Um relatório por mês, montado automaticamente a partir do Desempenho.</p>
        </div>
      </header>
      <SocialNav clientId={id} current="relatorios" />

      {missing ? (
        <MigrationNotice />
      ) : (
        <div className="space-y-8">
          <CreateReport clientId={id} />
          <section>
            <h2 className="h-display mb-4 text-3xl text-wine">Relatórios do cliente</h2>
            {reports.length === 0 ? (
              <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum relatório ainda. Gere o primeiro acima.</p>
            ) : (
              <ul className="space-y-2">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/clients/${id}/relatorios/${r.month.slice(0, 7)}`} className="card card-hover flex flex-wrap items-center gap-3 p-4">
                      <span className="h-display min-w-0 flex-1 basis-40 text-2xl text-wine">{monthLabel(r.month)}</span>
                      <span className={cn('rounded-full px-3 py-1 text-xs', r.status === 'sent' || r.status === 'final' ? 'bg-wine text-white' : 'bg-blush text-wine')}>{REPORT_STATUS_LABEL[r.status]}</span>
                      <span className="flex items-center gap-1.5 text-xs text-ink/55">{r.visible_to_client ? <><Eye className="size-3.5" /> Visível ao cliente</> : <><EyeOff className="size-3.5" /> Só você</>}</span>
                      <span className="text-xs text-ink/40">atualizado {fmtStamp(r.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
