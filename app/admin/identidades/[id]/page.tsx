import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, listClients, requireUser } from '@/lib/data/clients';
import { ensureStages, fetchIdentityDetail } from '@/lib/data/identity';
import { getSiteUrl } from '@/lib/site-url';
import { STAGES, STAGE_BY_KEY, STAGE_STATUS_META, isStageKey, stageSentence } from '@/lib/identity/types';
import { ProgressBar, ProjectStatusBadge, StageStatusBadge } from '@/components/identity/ui';
import { ProjectForm } from '@/components/identity/ProjectForm';
import { DeleteProjectButton, FinalizeButton, IdentityLink, StageSwitch } from '@/components/identity/ProjectActions';
import { StageWorkspace } from '@/components/identity/StageWorkspace';
import { DecisionsPanel } from '@/components/identity/DecisionsPanel';
import { PortalAccess } from '@/components/admin/PortalAccess';
import { QuickLinks } from '@/components/identity/QuickLinks';
import { StageTabs } from '@/components/identity/StageTabs';
import { HistoryList } from '@/components/content/Thread';
import { Avatar } from '@/components/ui/Misc';
import { Pencil } from 'lucide-react';
import { cn, fmtDate } from '@/lib/utils';

export const metadata = { title: 'Identidade visual' };

export default async function IdentityProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etapa?: string }> }) {
  const { id } = await params;
  const etapa = (await searchParams).etapa ?? 'geral';
  const user = await requireUser();
  const supabase = await createClient();
  let detail = await fetchIdentityDetail(supabase, id);
  if (!detail) notFound();
  // projeto sem todas as etapas (criado quando a criação falhou): recria as que faltam e recarrega
  if (await ensureStages(supabase, id, detail.stages.map((st) => st.stage_key))) {
    const fresh = await fetchIdentityDetail(supabase, id);
    if (fresh) detail = fresh;
  }
  const { project, stages, activity } = detail;
  // a lista de clientes só é usada no formulário da Visão geral: nas outras etapas não precisa carregar
  const needsClients = !etapa || etapa === 'geral' || !(isStageKey(etapa) || etapa === 'historico' || etapa === 'decisoes');
  const [client, clients] = await Promise.all([getClient(project.client_id), needsClients ? listClients() : Promise.resolve([])]);
  if (!client) notFound();

  const { data: portalUsers } = needsClients ? await supabase.from('client_portal_users').select('id, email, last_login_at').eq('client_id', client.id).order('created_at') : { data: [] };
  const base = `/admin/identidades/${id}`;
  const url = `${await getSiteUrl()}/brand/review/${project.review_token}`;
  const activeStage = isStageKey(etapa) ? stages.find((s) => s.stage_key === etapa) : undefined;
  const tab = etapa === 'historico' || etapa === 'decisoes' ? etapa : activeStage ? activeStage.stage_key : 'geral';

  const tabs = [
    { key: 'geral', label: 'Visão geral', href: base, muted: false },
    ...STAGES.map((m) => {
      const st = stages.find((s) => s.stage_key === m.key);
      return { key: m.key as string, label: `${m.number} ${m.label}`, href: `${base}?etapa=${m.key}`, muted: !!st && !st.enabled };
    }),
    { key: 'decisoes', label: 'Decisões do cliente', href: `${base}?etapa=decisoes`, muted: false },
    { key: 'historico', label: 'Histórico', href: `${base}?etapa=historico`, muted: false },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/identidades" className="label text-wine/70 hover:text-wine">← Identidades visuais</Link>

      <header className="mb-8 mt-4 flex flex-wrap items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div className="min-w-0 flex-1">
          <p className="label mb-1 text-wine/70">{client.company_name}</p>
          <h1 className="h-display text-3xl text-wine sm:text-4xl">{project.name}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ProjectStatusBadge status={project.status} />
          <Link href={`/admin/clients/${client.id}/edit?next=${encodeURIComponent(base)}`} className="inline-flex items-center gap-1.5 text-xs text-wine underline-offset-4 hover:underline">
            <Pencil className="size-3.5" /> Editar perfil do cliente
          </Link>
        </div>
      </header>

      {/* acesso rápido: pasta do Drive, formulário do Google… (privado) */}
      <div className="mb-8 -mt-3">
        <QuickLinks projectId={id} links={project.links ?? []} />
      </div>

      <StageTabs tabs={tabs} current={tab} />

      {tab === 'geral' && (
        <div className="space-y-8">
          <section className="card space-y-6 p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Cliente', client.company_name],
                ['Projeto', project.name],
                ['Criado em', fmtDate(project.created_at.slice(0, 10), true)],
                ['Última atualização', fmtDate(project.updated_at.slice(0, 10), true)],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="label mb-1 text-wine/70">{l}</p>
                  <p className="text-sm">{v}</p>
                </div>
              ))}
            </div>
            <ProgressBar stages={stages} />
            <IdentityLink projectId={id} clientId={client.id} url={url} active={project.token_active} />
          </section>

          <PortalAccess clientId={client.id} required={!!(client as { portal_login_required?: boolean }).portal_login_required} users={portalUsers ?? []} />

          <section className="card p-5 sm:p-7">
            <h2 className="h-display mb-1 text-2xl text-wine">Etapas</h2>
            <p className="mb-5 text-sm text-ink/60">Ative só o que este projeto vai usar. Etapas desativadas somem do portal do cliente e do progresso.</p>
            <ul className="divide-y divide-wine/10">
              {STAGES.map((m) => {
                const st = stages.find((s) => s.stage_key === m.key);
                if (!st) return null;
                return (
                  <li key={m.key} className={cn('flex items-center gap-4 py-3', !st.enabled && 'opacity-50')}>
                    <span className="w-5 text-center text-wine">{st.enabled ? STAGE_STATUS_META[st.status].symbol : '—'}</span>
                    <Link href={`${base}?etapa=${m.key}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block text-sm">{m.number} · {st.enabled ? (m.approvable ? stageSentence(m.key, st.status) : st.status === 'approved' ? 'Arquivos publicados' : 'Arquivos ainda não publicados') : `${m.label} (desativada)`}</span>
                      <span className="block text-xs text-ink/50">{m.hint}</span>
                    </Link>
                    {st.enabled && m.approvable && <StageStatusBadge status={st.status} version={st.current_version} stageKey={m.key} className="hidden sm:inline-flex" />}
                    <StageSwitch stageId={st.id} enabled={st.enabled} label={m.label} />
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card p-5 sm:p-7">
            <h2 className="h-display mb-5 text-2xl text-wine">Dados do projeto</h2>
            <ProjectForm clients={clients.map((c) => ({ id: c.id, company_name: c.company_name }))} project={project} />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-wine/10 pt-5">
              <FinalizeButton projectId={id} finalized={project.status === 'finalized'} />
              <DeleteProjectButton projectId={id} name={project.name} />
            </div>
          </section>
        </div>
      )}

      {activeStage && tab !== 'geral' && tab !== 'historico' && (
        <div>
          <p className="mb-5 text-sm text-ink/60">{STAGE_BY_KEY[activeStage.stage_key].hint}</p>
          <StageWorkspace key={activeStage.id} stage={activeStage} detail={detail} ctx={{ ownerId: user.id, clientId: client.id, projectId: id }} />
        </div>
      )}

      {tab === 'decisoes' && <DecisionsPanel detail={detail} />}

      {tab === 'historico' && (
        <section className="card p-5 sm:p-7">
          {activity.length ? <HistoryList history={activity.map((a) => ({ ...a, client_id: a.project_id, content_id: a.stage_id }))} /> : <p className="text-sm text-ink/60">Nenhuma atividade ainda.</p>}
        </section>
      )}
    </div>
  );
}
