import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProfile, listClients, requireUser } from '@/lib/data/clients';
import { ProfileEditor } from '@/components/admin/ProfileEditor';
import { fetchCards } from '@/lib/data/content';
import { loadAllTasks } from '@/lib/data/production';
import { productionStats } from '@/lib/production/stats';
import { AWAITING } from '@/lib/constants';
import { ContentRow } from '@/components/content/ContentCard';
import { DemoButton } from '@/components/admin/DemoButton';
import { BrandElement } from '@/components/brand/Brand';
import { EmptyState } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';
import { firstName } from '@/lib/utils';
import type { ContentStatus } from '@/lib/types';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const user = await requireUser();
  const supabase = await createClient();
  const [clients, items, profile, prod] = await Promise.all([listClients(), fetchCards(supabase), getProfile(), loadAllTasks(supabase)]);
  const prodStats = prod.missing ? null : productionStats(prod.tasks, prod.columns);

  const count = (...s: ContentStatus[]) => items.filter((i) => s.includes(i.status)).length;
  const stats = [
    { label: 'Clientes', value: clients.length, href: '/admin/clients' },
    { label: 'Aguardando aprovação', value: count(...AWAITING), href: '/admin/content?status=pending_approval,revised_pending' },
    { label: 'Aprovados', value: count('approved'), href: '/admin/content?status=approved' },
    { label: 'Precisam de alteração', value: count('changes_requested'), href: '/admin/content?status=changes_requested', highlight: true },
    { label: 'Programados', value: count('scheduled'), href: '/admin/content?status=scheduled' },
    { label: 'Publicados', value: count('published'), href: '/admin/content?status=published' },
  ];

  const clientName = new Map(clients.map((c) => [c.id, c.company_name]));
  const attention = [
    ...items.filter((i) => i.status === 'changes_requested'),
    ...items.filter((i) => AWAITING.includes(i.status)),
    ...items.filter((i) => i.status === 'draft'),
  ].slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center gap-5">
        <ProfileEditor ownerId={user.id} name={profile.name} hasName={profile.hasName} avatarUrl={profile.avatarUrl} avatarPath={profile.avatarPath} />
        <header>
          <p className="label mb-2 text-wine/70">Dashboard</p>
          <h1 className="h-display text-4xl text-wine sm:text-5xl">
            Olá{profile.hasName && <>, <span className="script text-5xl sm:text-6xl">{firstName(profile.name)}</span></>} ♡
          </h1>
          {!profile.hasName && <p className="mt-1 text-xs text-ink/55">Clique na sua foto para adicionar seu nome e uma imagem.</p>}
        </header>
      </div>

      {clients.length === 0 ? (
        <EmptyState title="Vamos começar?">
          <p className="mb-5">Cadastre seu primeiro cliente ou carregue um cliente fictício com 9 conteúdos para ver o sistema funcionando.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <DemoButton />
            <LinkButton href="/admin/clients/new" variant="outline">Novo cliente</LinkButton>
          </div>
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {stats.map((s, i) => (
              <Link
                key={s.label}
                href={s.href}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`group card card-hover animate-rise relative overflow-hidden p-5 sm:p-6 ${s.highlight && s.value > 0 ? '!border-wine !bg-wine text-white' : ''}`}
              >
                <p className={`label ${s.highlight && s.value > 0 ? 'text-white/80' : 'text-wine/70'}`}>{s.label}</p>
                <p className={`h-display mt-3 text-6xl ${s.highlight && s.value > 0 ? 'text-white' : 'text-wine'}`}>{s.value}</p>
                <ArrowUpRight className="absolute right-4 top-4 size-4 opacity-0 transition group-hover:opacity-70" />
              </Link>
            ))}
          </section>

          {prodStats && (
            <section className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div>
                <p className="label mb-1 text-wine/70">Produção</p>
                <h2 className="h-display text-2xl text-wine sm:text-3xl">Tarefas de hoje</h2>
                <p className="mt-1 text-sm text-ink/65">
                  {prodStats.today === 0 && prodStats.overdue === 0
                    ? 'Nada vence hoje. ♡'
                    : <>{prodStats.today} {prodStats.today === 1 ? 'tarefa' : 'tarefas'}{prodStats.urgentToday > 0 && <> · <strong className="font-normal text-wine">{prodStats.urgentToday} {prodStats.urgentToday === 1 ? 'urgente' : 'urgentes'}</strong></>}{prodStats.overdue > 0 && <> · <strong className="font-normal text-red-700">{prodStats.overdue} {prodStats.overdue === 1 ? 'atrasada' : 'atrasadas'}</strong></>}</>}
                </p>
              </div>
              <LinkButton href="/admin/producao">Ver produção</LinkButton>
            </section>
          )}

          <section className="relative mt-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="label mb-1 text-wine/70">Atenção</p>
                <h2 className="h-display text-3xl text-wine">Precisam de você</h2>
              </div>
              <Link href="/admin/content" className="text-sm text-wine underline-offset-4 hover:underline">Ver todos</Link>
            </div>
            {attention.length === 0 ? (
              <EmptyState title="Tudo em dia ✦">Nenhum conteúdo pendente no momento.</EmptyState>
            ) : (
              <div className="space-y-3">
                {attention.map((i) => (
                  <ContentRow deletable key={i.id} item={i} href={`/admin/content/${i.id}`} clientName={clientName.get(i.client_id)} />
                ))}
              </div>
            )}
            <BrandElement name="brush-stroke" tone="wine" className="mt-10 w-48 opacity-40" />
          </section>
        </>
      )}
    </div>
  );
}
