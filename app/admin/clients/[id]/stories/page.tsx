import { redirect } from 'next/navigation';

/** Atalho antigo: agora vive dentro de "Cronograma de entregas". */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/clients/${id}/cronograma?aba=stories`);
}
