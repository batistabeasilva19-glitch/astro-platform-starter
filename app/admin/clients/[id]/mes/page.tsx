import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { adminPlans, contentOptions } from '@/lib/data/extras';
import { Avatar } from '@/components/ui/Misc';
import { SocialNav } from '@/components/perf/SocialNav';
import { MissingNotice } from '@/components/extras/MissingNotice';
import { PlanManager } from '@/components/extras/PlanManager';

export const metadata = { title: 'Calendário do mês' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const supabase = await createClient();
  const { plans, missing, thumbs } = await adminPlans(supabase, id);
  const contents = missing ? [] : await contentOptions(supabase, id);
  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-6 mt-4 flex items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div>
          <p className="label mb-1 text-wine/70">Redes sociais</p>
          <h1 className="h-display text-3xl text-wine sm:text-4xl">Calendário do mês</h1>
          <p className="mt-1 text-sm text-ink/60">Monte o mês em ordem (posts, carrosséis e Reels) e envie para o cliente aprovar.</p>
        </div>
      </header>
      <SocialNav clientId={id} current="mes" />
      {missing ? <MissingNotice /> : <PlanManager clientId={id} plans={plans} thumbs={thumbs} contents={contents} />}
    </div>
  );
}
