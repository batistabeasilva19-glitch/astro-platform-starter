import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { releasedReport, signReportAssets } from '@/lib/data/perf';
import { createAdminClient } from '@/lib/supabase/admin';
import { buttonClass } from '@/components/ui/Button';
import { ReportDocument } from '@/components/perf/ReportDocument';

export const metadata = { title: 'Resultados' };

export default async function ResultPage({ params }: { params: Promise<{ token: string; month: string }> }) {
  const { token, month } = await params;
  const session = await resolveToken(token);
  if (!session || !/^\d{4}-\d{2}$/.test(month)) notFound();
  const rep = await releasedReport(createAdminClient(), session.client.id, `${month}-01`);
  if (!rep) notFound();
  const { thumbs, logo } = await signReportAssets(rep.data);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/review/${token}/resultados`} className="inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3">
          <ArrowLeft className="size-4" /> Todos os relatórios
        </Link>
        <a href={`/review/${token}/resultados/${month}/pdf`} className={buttonClass('primary', 'md')}><Download className="size-4" /> Baixar PDF</a>
      </div>
      <ReportDocument data={rep.data} edits={rep.edits} thumbs={thumbs} logo={logo} />
    </div>
  );
}
