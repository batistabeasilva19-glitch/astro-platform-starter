import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { getSocialForm } from '@/lib/data/social-form';
import { Avatar } from '@/components/ui/Misc';
import { MissingNotice } from '@/components/extras/MissingNotice';
import { SocialFormAdmin } from '@/components/social-form/SocialFormAdmin';
import { SocialFormView } from '@/components/social-form/SocialFormView';

export const metadata = { title: 'Formulário de perfil' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const { form, missing } = await getSocialForm(await createClient(), id);
  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-6 mt-4 flex items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div>
          <p className="label mb-1 text-wine/70">Redes sociais</p>
          <h1 className="text-3xl font-medium tracking-tight text-wine sm:text-4xl">Formulário de perfil</h1>
          <p className="mt-1 text-sm text-ink/60">Perguntas para entender o negócio, o público e os perfis de que o cliente gosta.</p>
        </div>
      </header>
      {missing ? (
        <MissingNotice file="0016_formulario_social.sql" />
      ) : (
        <div className="space-y-8">
          <SocialFormAdmin clientId={id} status={form?.status ?? null} kind={form?.kind ?? 'business'} answers={form?.answers ?? {}} submittedAt={form?.submitted_at ?? null} submittedBy={form?.submitted_by ?? null} />
          {form && <SocialFormView answers={form.answers} kind={form.kind} />}
        </div>
      )}
    </div>
  );
}
