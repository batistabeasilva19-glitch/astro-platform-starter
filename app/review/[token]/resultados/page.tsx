import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { listReleasedReports } from '@/lib/data/perf';
import { createAdminClient } from '@/lib/supabase/admin';
import { monthLabel } from '@/lib/perf/calc';
import { EmptyState } from '@/components/ui/Misc';

export const metadata = { title: 'Resultados' };

export default async function ResultsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const reports = await listReleasedReports(createAdminClient(), session.client.id);

  return (
    <div>
      <Link href={`/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3">
        <ArrowLeft className="size-4" /> Voltar para os conteúdos
      </Link>
      <header className="mb-10">
        <p className="label mb-3 text-wine/70">Desempenho</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Resultados</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Os relatórios mensais do seu Instagram, com gráficos, melhores conteúdos e análises. Escolha o mês para ver ou baixar o PDF.</p>
      </header>
      {reports.length === 0 ? (
        <EmptyState title="Ainda não há relatórios">Assim que a Soltria liberar o relatório de um mês, ele aparece aqui. ♡</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reports.map((r) => (
            <li key={r.month}>
              <Link href={`/review/${token}/resultados/${r.month.slice(0, 7)}`} className="card card-hover flex items-center gap-4 p-5">
                <span className="min-w-0 flex-1">
                  <span className="label block text-wine/60">Relatório mensal</span>
                  <span className="h-display text-3xl text-wine">{monthLabel(r.month)}</span>
                </span>
                <ArrowRight className="size-5 text-wine" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
