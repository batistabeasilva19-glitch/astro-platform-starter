import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { listPublicStrategyDocs } from '@/lib/data/strategy';
import { createAdminClient } from '@/lib/supabase/admin';
import { StrategyBrowser } from '@/components/strategy/StrategyBrowser';

export const metadata = { title: 'Estratégia de rede' };

export default async function StrategyPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const docs = await listPublicStrategyDocs(createAdminClient(), session.client.id);

  return (
    <div>
      <Link href={`/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3">
        <ArrowLeft className="size-4" /> Voltar para os conteúdos
      </Link>
      <header className="mb-10">
        <p className="label mb-3 text-wine/70">Documentos</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Estratégia de rede</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Aqui ficam os documentos de estratégia da sua marca, organizados por mês. Escolha o mês para encontrar o que precisa.</p>
      </header>
      <StrategyBrowser token={token} docs={docs} />
    </div>
  );
}
