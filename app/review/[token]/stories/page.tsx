import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { portalStories } from '@/lib/data/extras';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/components/ui/Misc';
import { StoriesChecklist } from '@/components/portal-extras/StoriesChecklist';

export const metadata = { title: 'Stories' };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const { rows, thumbs } = await portalStories(createAdminClient(), session.client.id);
  return (
    <div>
      <Link href={`/review/${token}/cronograma`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3"><ArrowLeft className="size-4" /> Cronograma de entregas</Link>
      <header className="mb-8">
        <p className="label mb-3 text-wine/70">Publicações</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Stories</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Os stories de cada dia, na ordem em que devem ser postados. Depois de postar, toque em “OK, postei”.</p>
      </header>
      {rows.length === 0 ? <EmptyState title="Ainda não há stories">Quando a Soltria organizar os stories do dia, eles aparecem aqui. ♡</EmptyState> : <StoriesChecklist token={token} rows={rows} thumbs={thumbs} />}
    </div>
  );
}
