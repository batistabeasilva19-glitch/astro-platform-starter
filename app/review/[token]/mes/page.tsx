import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { portalPlans } from '@/lib/data/extras';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/components/ui/Misc';
import { PlanReview } from '@/components/portal-extras/PlanReview';

export const metadata = { title: 'Calendário do mês' };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const { plans, thumbs } = await portalPlans(createAdminClient(), session.client.id);
  return (
    <div>
      <Link href={`/review/${token}/cronograma`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3"><ArrowLeft className="size-4" /> Cronograma de entregas</Link>
      <header className="mb-8">
        <p className="label mb-3 text-wine/70">Planejamento</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Calendário do mês</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Posts, carrosséis e Reels planejados para o mês, em ordem. Aprove um por um ou o calendário completo de uma vez; se algo precisar mudar, é só pedir.</p>
      </header>
      {plans.length === 0 ? <EmptyState title="Ainda não há calendário para aprovar">Quando a Soltria enviar o planejamento do mês, ele aparece aqui. ♡</EmptyState> : <PlanReview token={token} plans={plans} thumbs={thumbs} />}
    </div>
  );
}
