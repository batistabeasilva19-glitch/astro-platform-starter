import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { getReport, reportData, signReportAssets } from '@/lib/data/perf';
import { monthLabel } from '@/lib/perf/calc';
import { Avatar } from '@/components/ui/Misc';
import { buttonClass } from '@/components/ui/Button';
import { SocialNav, MigrationNotice } from '@/components/perf/SocialNav';
import { CreateReport } from '@/components/perf/CreateReport';
import { ReportEditor } from '@/components/perf/ReportEditor';
import { ReportDocument } from '@/components/perf/ReportDocument';
import { KpiGrid } from '@/components/perf/blocks';

export const metadata = { title: 'Relatório mensal' };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string; month: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id, month: m } = await params;
  const { aba } = await searchParams;
  await requireUser();
  if (!/^\d{4}-\d{2}$/.test(m)) notFound();
  const month = `${m}-01`;
  const client = await getClient(id);
  if (!client) notFound();
  const supabase = await createClient();
  const rep = await getReport(supabase, id, month);
  const { error } = await supabase.from('perf_reports').select('id').limit(1);
  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <MigrationNotice />
      </div>
    );
  }

  const head = (
    <>
      <Link href={`/admin/clients/${id}/relatorios`} className="label text-wine/70 hover:text-wine">← Relatórios</Link>
      <header className="mb-6 mt-4 flex items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div>
          <p className="label mb-1 text-wine/70">{client.company_name}</p>
          <h1 className="h-display text-3xl text-wine sm:text-4xl">Relatório de {monthLabel(month)}</h1>
        </div>
      </header>
      <SocialNav clientId={id} current="relatorios" />
    </>
  );

  if (!rep) {
    return (
      <div className="mx-auto max-w-3xl">
        {head}
        <CreateReport clientId={id} defaultMonth={m} />
      </div>
    );
  }

  const { data, frozen } = await reportData(supabase, client, rep.row, month);

  if (aba === 'preview') {
    const { thumbs, logo } = await signReportAssets(data);
    return (
      <div className="mx-auto max-w-5xl">
        {head}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href={`/admin/clients/${id}/relatorios/${m}`} className={buttonClass('ghost', 'md')}><ArrowLeft className="size-4" /> Voltar para a edição</Link>
          <div className="flex gap-2">
            <Link href={`/admin/clients/${id}/relatorios/${m}`} className={buttonClass('outline', 'md')}><Pencil className="size-4" /> Editar</Link>
            <a href={`/admin/clients/${id}/relatorios/${m}/pdf`} className={buttonClass('primary', 'md')}><Download className="size-4" /> Exportar PDF</a>
          </div>
        </div>
        <p className="mb-4 text-center text-xs text-ink/50">Pré-visualização {frozen ? '(dados congelados na finalização)' : '(dados atuais do mês)'} — o PDF usa as mesmas seções, em páginas A4.</p>
        <ReportDocument data={data} edits={rep.edits} thumbs={thumbs} logo={logo} paper />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {head}
      <ReportEditor
        key={`${rep.row.updated_at}-${rep.row.status}-${rep.versions.length}`}
        clientId={id}
        label={monthLabel(month)}
        report={{ id: rep.row.id, month: rep.row.month, status: rep.row.status, visible: rep.row.visible_to_client, finalized_at: rep.row.finalized_at, sent_at: rep.row.sent_at }}
        edits={rep.edits}
        versions={rep.versions}
        summary={<KpiGrid cur={data.profile.cur} prev={data.profile.prev} prevLabel={data.prevRange.label} />}
      />
    </div>
  );
}
