import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { portalScripts } from '@/lib/data/extras';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/components/ui/Misc';
import { ScriptsList } from '@/components/portal-extras/ScriptsList';

export const metadata = { title: 'Roteiros' };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const rows = await portalScripts(createAdminClient(), session.client.id);
  return (
    <div>
      <Link href={`/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3"><ArrowLeft className="size-4" /> Voltar</Link>
      <header className="mb-8">
        <p className="label mb-3 text-wine/70">Gravações</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Roteiros</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Os vídeos que precisam ser gravados, na ordem sugerida. Toque em “Copiar roteiro” para levar o texto direto para o seu celular.</p>
      </header>
      {rows.length === 0 ? <EmptyState title="Ainda não há roteiros">Assim que a Soltria enviar os roteiros, eles aparecem aqui. ♡</EmptyState> : <ScriptsList rows={rows} />}
    </div>
  );
}
