import Link from 'next/link';
import { Clapperboard, GalleryHorizontal, ImageOff, Play } from 'lucide-react';
import type { ContentCardData } from '@/lib/types';
import { FORMAT_META } from '@/lib/constants';
import { fmtDate, fmtTime } from '@/lib/utils';
import { FormatIcon, StatusBadge } from './Badges';
import { LightImage } from './LightImage';

export function Thumb({ item, className = '' }: { item: ContentCardData; className?: string }) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden bg-blush ${className}`}>
      {item.thumb ? (
        <LightImage src={item.thumb} alt="" width={540} className="size-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-wine/40">
          <ImageOff className="size-6" />
          <span className="text-xs">Sem arte</span>
        </div>
      )}
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.7rem] text-wine">
        <FormatIcon format={item.format} className="size-3.5" />
        {FORMAT_META[item.format].label}
      </span>
      {(item.format === 'reel' || item.format === 'video') && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white/85 p-3 text-wine">
            <Play className="size-5 fill-current" />
          </span>
        </span>
      )}
      {item.slide_count > 1 && (
        <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2 py-1 text-[0.68rem] text-white">
          {item.slide_count} {item.format === 'story' ? 'telas' : 'slides'}
        </span>
      )}
    </div>
  );
}

export function ContentCard({
  item,
  href,
  audience = 'admin',
  clientName,
}: {
  item: ContentCardData;
  href: string;
  audience?: 'admin' | 'client';
  clientName?: string;
}) {
  return (
    <Link href={href} className="group card card-hover block overflow-hidden focus-visible:outline-2 focus-visible:outline-wine">
      <Thumb item={item} />
      <div className="space-y-2.5 p-4">
        <p className="label text-ink/55">
          {fmtDate(item.scheduled_date, true)}
          {item.scheduled_time ? ` · ${fmtTime(item.scheduled_time)}` : ''}
        </p>
        <h3 className="font-sans line-clamp-2 text-[1.1rem] font-medium leading-snug tracking-tight text-wine">{item.title}</h3>
        {clientName && <p className="text-xs text-ink/55">{clientName}</p>}
        <StatusBadge status={item.status} audience={audience} />
      </div>
    </Link>
  );
}

/** Linha compacta para a visão em lista. */
export function ContentRow({
  item,
  href,
  audience = 'admin',
  clientName,
}: {
  item: ContentCardData;
  href: string;
  audience?: 'admin' | 'client';
  clientName?: string;
}) {
  const Icon = item.format === 'carousel' ? GalleryHorizontal : Clapperboard;
  void Icon;
  return (
    <Link href={href} className="group card card-hover flex items-center gap-4 p-3 pr-5 focus-visible:outline-2 focus-visible:outline-wine">
      <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-blush sm:size-20">
        {item.thumb ? <LightImage src={item.thumb} alt="" width={360} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><ImageOff className="size-5 text-wine/40" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="label mb-1 flex flex-wrap items-center gap-x-3 text-ink/55">
          <span>{fmtDate(item.scheduled_date, true)}{item.scheduled_time ? ` · ${fmtTime(item.scheduled_time)}` : ''}</span>
          <span className="inline-flex items-center gap-1 normal-case tracking-normal text-wine"><FormatIcon format={item.format} className="size-3.5" />{FORMAT_META[item.format].label}</span>
        </p>
        <h3 className="font-sans truncate text-base font-medium tracking-tight text-wine">{item.title}</h3>
        {clientName && <p className="truncate text-xs text-ink/55">{clientName}</p>}
      </div>
      <StatusBadge status={item.status} audience={audience} className="hidden shrink-0 sm:inline-flex" />
      <span className="size-2 shrink-0 rounded-full bg-wine sm:hidden" aria-label={item.status} />
    </Link>
  );
}
