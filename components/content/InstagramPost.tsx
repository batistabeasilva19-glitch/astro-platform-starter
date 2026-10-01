'use client';

import { RichText } from '@/components/ui/RichText';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import type { ContentFormat, VersionWithMedia } from '@/lib/types';
import { Avatar } from '@/components/ui/Misc';
import { Carousel, Placeholder, VideoPlayer } from './Carousel';
import { StoryViewer } from './StoryViewer';
import { LightImage } from './LightImage';
import { fmtDuration } from '@/lib/utils';

interface Props {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  format: ContentFormat;
  version: VersionWithMedia;
  slideIndex?: number;
  onSlideChange?: (i: number) => void;
}

/** Representação própria (inspirada na estrutura de uma publicação) — não copia a UI oficial. */
export function InstagramPost({ handle, displayName, avatarUrl, format, version, slideIndex, onSlideChange }: Props) {
  const images = version.media.filter((m) => m.kind === 'image');
  const video = version.media.find((m) => m.kind === 'video');
  const cover = version.media.find((m) => m.kind === 'cover');

  if (format === 'story') {
    return (
      <div className="mx-auto w-full max-w-[340px]">
        <StoryViewer handle={handle} avatarUrl={avatarUrl} displayName={displayName} images={images} />
        <CaptionBlock version={version} handle={handle} compact />
      </div>
    );
  }

  return (
    <article className="card mx-auto w-full max-w-[470px] overflow-hidden !rounded-[1.75rem]">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar name={displayName} src={avatarUrl} className="size-9 text-xs ring-2 ring-wine/20 ring-offset-2" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[0.85rem] font-normal">@{handle}</p>
          <p className="truncate text-[0.7rem] text-ink/50">
            {format === 'reel' ? 'Reel' : format === 'video' ? 'Vídeo' : format === 'carousel' ? 'Carrossel' : 'Publicação'}
            {(format === 'reel' || format === 'video') && version.duration_seconds ? ` · ${fmtDuration(version.duration_seconds)}` : ''}
          </p>
        </div>
      </header>

      {format === 'carousel' ? (
        <Carousel images={images} onIndexChange={onSlideChange} index={slideIndex} />
      ) : format === 'reel' || format === 'video' ? (
        <VideoPlayer src={video?.url} poster={cover?.url} aspect={format === 'reel' ? 'story' : 'portrait'} />
      ) : images[0] ? (
        <LightImage src={images[0].url} alt="Arte do post" className="aspect-[4/5] w-full bg-blush object-cover" />
      ) : (
        <Placeholder text="Nenhuma arte enviada ainda" />
      )}

      <div className="flex items-center gap-4 px-4 pt-3 text-wine">
        <Heart className="size-6" aria-hidden />
        <MessageCircle className="size-6" aria-hidden />
        <Send className="size-6" aria-hidden />
        <Bookmark className="ml-auto size-6" aria-hidden />
      </div>
      <CaptionBlock version={version} handle={handle} />
    </article>
  );
}

function CaptionBlock({ version, handle, compact }: { version: VersionWithMedia; handle: string; compact?: boolean }) {
  const hasText = version.caption || version.cta || version.hashtags;
  if (!hasText) return compact ? null : <div className="pb-4" />;
  return (
    <div className={compact ? 'card mt-4 p-4' : 'px-4 pb-5 pt-2'}>
      <p className="whitespace-pre-line text-[0.88rem] font-light leading-relaxed">
        <span className="mr-1.5 font-normal">@{handle}</span>
      </p>
      {version.caption && <RichText text={version.caption} className="text-[0.88rem] font-light leading-relaxed" />}
      {version.cta && <p className="mt-2 whitespace-pre-line text-[0.88rem] font-normal leading-relaxed text-wine">{version.cta}</p>}
      {version.hashtags && <p className="mt-2 text-[0.85rem] leading-relaxed text-wine/80">{version.hashtags}</p>}
    </div>
  );
}
