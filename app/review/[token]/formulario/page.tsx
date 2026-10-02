import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { getSocialForm } from '@/lib/data/social-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/components/ui/Misc';
import { SocialForm } from '@/components/social-form/SocialForm';

export const metadata = { title: 'Formulário de perfil' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const { form } = await getSocialForm(createAdminClient(), session.client.id);
  return (
    <div>
      <Link href={`/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3"><ArrowLeft className="size-4" /> Voltar</Link>
      <header className="mb-8">
        <p className="label mb-3 text-wine/70">Conhecendo você</p>
        <h1 className="text-4xl font-medium tracking-tight text-wine sm:text-5xl">Formulário de perfil</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Conte sobre o seu negócio, o seu público e os perfis de que você gosta. É com isso que montamos um planejamento de conteúdo com a sua cara.</p>
      </header>
      {!form ? (
        <EmptyState title="O formulário ainda não está disponível">Assim que a Soltria enviar, ele aparece aqui. ♡</EmptyState>
      ) : (
        <SocialForm token={token} kind={form.kind} initial={form.answers} updatedAt={form.updated_at} files={form.files} submitted={form.status === 'submitted'} submittedBy={form.submitted_by} submittedAt={form.submitted_at} />
      )}
    </div>
  );
}
