import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clientDetail, resolveToken } from '@/lib/data/portal';
import { ReviewContent } from '@/components/review/ReviewContent';
import { FormatTag, StatusBadge } from '@/components/content/Badges';
import { fmtDateLong, fmtTime } from '@/lib/utils';

export default async function ReviewContentPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const content = await clientDetail(session, id);
  if (!content) notFound();
  const { client } = session;

  return (
    <div>
      <Link href={`/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3">
        <ArrowLeft className="size-4" /> Todos os conteúdos
      </Link>
      <header className="mb-8">
        <p className="label mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-wine/70">
          <FormatTag format={content.format} className="text-wine" />
          <span className="capitalize">{fmtDateLong(content.scheduled_date)}{content.scheduled_time ? ` · ${fmtTime(content.scheduled_time)}` : ''}</span>
        </p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">{content.title}</h1>
        <div className="mt-4"><StatusBadge status={content.status} audience="client" /></div>
      </header>
      <ReviewContent
        token={token}
        content={content}
        client={{ handle: client.instagram_handle, displayName: client.display_name || client.company_name, avatarUrl: session.avatarUrl }}
      />
    </div>
  );
}
