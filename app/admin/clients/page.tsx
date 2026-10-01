import Link from 'next/link';
import { Palette, Plus, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@/lib/data/clients';
import { DemoButton } from '@/components/admin/DemoButton';
import { ProgressBar, ProjectStatusBadge } from '@/components/identity/ui';
import { Avatar, EmptyState, PageTitle } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';
import { AWAITING } from '@/lib/constants';
import { progressOf, type IdentityStatus, type StageKey, type StageStatus } from '@/lib/identity/types';
import type { ClientWithProject } from '@/lib/types';

export const metadata = { title: 'Clientes' };

interface IdentityRow {
  id: string;
  client_id: string;
  name: string;
  status: IdentityStatus;
}
interface StageRow {
  project_id: string;
  stage_key: StageKey;
  enabled: boolean;
  status: StageStatus;
}

export default async function ClientsPage() {
  const clients = await listClients();
  const supabase = await createClient();
  const [{ data: items }, { data: projects }, { data: stages }] = await Promise.all([
    supabase.from('content_items').select('client_id, status'),
    supabase.from('identity_projects').select('id, client_id, name, status').order('updated_at', { ascending: false }),
    supabase.from('identity_stages').select('project_id, stage_key, enabled, status'),
  ]);
  const identities = (projects ?? []) as IdentityRow[]; // vazio se a migration 0002 ainda não foi aplicada
  const stageRows = (stages ?? []) as StageRow[];

  const social = (id: string) => {
    const mine = (items ?? []).filter((i) => i.client_id === id);
    return { total: mine.length, awaiting: mine.filter((i) => AWAITING.includes(i.status)).length, changes: mine.filter((i) => i.status === 'changes_requested').length };
  };
  const brand = (id: string) => identities.filter((p) => p.client_id === id);

  const socialClients = clients.filter((c) => social(c.id).total > 0);
  const brandClients = clients.filter((c) => brand(c.id).length > 0);
  const noProject = clients.filter((c) => social(c.id).total === 0 && brand(c.id).length === 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        eyebrow="Projetos"
        title="Clientes"
        actions={
          <LinkButton href="/admin/clients/new">
            <Plus className="size-4" /> Novo cliente
          </LinkButton>
        }
      />

      {clients.length === 0 ? (
        <EmptyState title="Nenhum cliente ainda">
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <LinkButton href="/admin/clients/new">Cadastrar cliente</LinkButton>
            <DemoButton />
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-14">
          <nav className="flex flex-wrap gap-2 text-xs" aria-label="Áreas">
            <a href="#social" className="rounded-full border border-wine/30 px-4 py-1.5 text-wine transition hover:bg-blush">Social Mídia <span className="text-ink/40">{socialClients.length}</span></a>
            <a href="#identidade" className="rounded-full border border-wine/30 px-4 py-1.5 text-wine transition hover:bg-blush">Identidade Visual <span className="text-ink/40">{brandClients.length}</span></a>
            {noProject.length > 0 && <a href="#sem-projeto" className="rounded-full border border-wine/30 px-4 py-1.5 text-wine transition hover:bg-blush">Sem projeto <span className="text-ink/40">{noProject.length}</span></a>}
          </nav>

          {/* ── Clientes de Social Mídia ───────────────────────────── */}
          <section id="social" className="scroll-mt-6">
            <SectionTitle icon={<Share2 className="size-5" />} title="Clientes · Social Mídia" count={socialClients.length} hint="Posts, carrosséis, Reels, Stories, calendário e aprovação de conteúdo." />
            {socialClients.length === 0 ? (
              <Empty text="Nenhum cliente com conteúdo de redes sociais ainda." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {socialClients.map((c, i) => {
                  const s = social(c.id);
                  return (
                    <Link key={c.id} href={`/admin/clients/${c.id}`} style={{ animationDelay: `${i * 50}ms` }} className="card card-hover animate-rise block p-6">
                      <ClientHead c={c} />
                      <div className="mt-5 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-blush px-3 py-1 text-wine">{s.total} conteúdos</span>
                        {s.awaiting > 0 && <span className="rounded-full border border-wine/30 px-3 py-1 text-wine">{s.awaiting} aguardando</span>}
                        {s.changes > 0 && <span className="rounded-full bg-wine px-3 py-1 text-white">{s.changes} p/ alterar</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Clientes de Identidade Visual ──────────────────────── */}
          <section id="identidade" className="scroll-mt-6">
            <SectionTitle icon={<Palette className="size-5" />} title="Clientes · Identidade Visual" count={brandClients.length} hint="Projetos de branding: conceito, logo, cores, tipografia e aplicações." />
            {brandClients.length === 0 ? (
              <Empty text="Nenhum cliente com projeto de identidade visual ainda.">
                <LinkButton href="/admin/identidades/new" variant="outline" size="sm">Nova identidade visual</LinkButton>
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {brandClients.map((c, i) => {
                  const list = brand(c.id);
                  const first = list[0];
                  const sts = stageRows.filter((r) => r.project_id === first.id);
                  const { pct } = progressOf(sts);
                  return (
                    <Link key={c.id} href={list.length === 1 ? `/admin/identidades/${first.id}` : `/admin/identidades?cliente=${c.id}`} style={{ animationDelay: `${i * 50}ms` }} className="card card-hover animate-rise block p-6">
                      <ClientHead c={c} />
                      <p className="mt-4 truncate text-sm text-ink/70">{list.length === 1 ? first.name : `${list.length} projetos de identidade`}</p>
                      <div className="mt-3">
                        <p className="label mb-1.5 text-wine/70">{pct}% concluído</p>
                        <ProgressBar stages={sts} showText={false} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ProjectStatusBadge status={first.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Clientes ainda sem nenhum projeto ──────────────────── */}
          {noProject.length > 0 && (
            <section id="sem-projeto" className="scroll-mt-6">
              <SectionTitle title="Sem projeto ainda" count={noProject.length} hint="Cadastrados, mas sem conteúdo nem identidade visual. Escolha por onde começar." />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {noProject.map((c) => (
                  <div key={c.id} className="card p-6">
                    <ClientHead c={c} />
                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <Link href={`/admin/clients/${c.id}`} className="text-wine underline-offset-4 hover:underline">Social Mídia →</Link>
                      <Link href={`/admin/identidades/new?client=${c.id}`} className="text-wine underline-offset-4 hover:underline">+ Identidade Visual →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ClientHead({ c }: { c: ClientWithProject }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar name={c.company_name} src={c.avatar_url} className="size-16 shrink-0 text-lg" />
      <div className="min-w-0">
        <h3 className="h-display truncate text-2xl text-wine">{c.company_name}</h3>
        <p className="truncate text-sm text-ink/60">@{c.instagram_handle || '—'}</p>
        {c.contact_name && <p className="truncate text-xs text-ink/50">Responsável: {c.contact_name}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, count, hint }: { icon?: React.ReactNode; title: string; count: number; hint: string }) {
  return (
    <header className="mb-5 border-b border-wine/15 pb-4">
      <h2 className="flex items-center gap-3 text-2xl font-medium tracking-tight text-wine sm:text-3xl">
        {icon && <span className="flex size-10 items-center justify-center rounded-2xl bg-blush">{icon}</span>}
        {title} <span className="label align-middle text-ink/40">{count}</span>
      </h2>
      <p className="mt-1.5 text-sm text-ink/60">{hint}</p>
    </header>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-10 text-center">
      <p className="text-sm text-ink/60">{text}</p>
      {children}
    </div>
  );
}
