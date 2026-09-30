import {
  CircleDashed,
  Clapperboard,
  GalleryHorizontal,
  Image as ImageIcon,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { ContentFormat, ContentStatus } from './types';

export const FORMAT_META: Record<ContentFormat, { label: string; plural: string; icon: LucideIcon }> = {
  post: { label: 'Post', plural: 'Posts', icon: ImageIcon },
  carousel: { label: 'Carrossel', plural: 'Carrosséis', icon: GalleryHorizontal },
  reel: { label: 'Reel', plural: 'Reels', icon: Clapperboard },
  story: { label: 'Story', plural: 'Stories', icon: CircleDashed },
  video: { label: 'Vídeo', plural: 'Vídeos', icon: Video },
};

export const FORMATS = Object.keys(FORMAT_META) as ContentFormat[];

/**
 * Status → rótulo + cores (somente tons da paleta Soltria).
 * `client` é o rótulo mostrado ao cliente (linguagem simples).
 */
export const STATUS_META: Record<
  ContentStatus,
  { label: string; client: string; chip: string; dot: string }
> = {
  draft: {
    label: 'Rascunho',
    client: 'Em preparo',
    chip: 'bg-ink/5 text-ink/70 border-ink/15',
    dot: 'bg-ink/40',
  },
  pending_approval: {
    label: 'Aguardando aprovação',
    client: 'Aguardando sua aprovação',
    chip: 'bg-blush text-wine border-wine/25',
    dot: 'bg-wine',
  },
  approved: {
    label: 'Aprovado',
    client: 'Aprovado ♡',
    chip: 'bg-wine text-white border-wine',
    dot: 'bg-white',
  },
  changes_requested: {
    label: 'Alteração solicitada',
    client: 'Alteração solicitada',
    chip: 'bg-white text-wine border-wine border-dashed',
    dot: 'bg-wine',
  },
  revised_pending: {
    label: 'Alterado — aguardando nova aprovação',
    client: 'Nova versão para revisar',
    chip: 'bg-blush text-wine border-wine/40',
    dot: 'bg-wine',
  },
  scheduled: {
    label: 'Programado',
    client: 'Programado',
    chip: 'bg-ink text-white border-ink',
    dot: 'bg-blush',
  },
  published: {
    label: 'Publicado',
    client: 'Publicado',
    chip: 'bg-ink/5 text-ink border-ink/30',
    dot: 'bg-ink',
  },
};

export const STATUSES = Object.keys(STATUS_META) as ContentStatus[];

/** Status em que o cliente precisa agir. */
export const AWAITING: ContentStatus[] = ['pending_approval', 'revised_pending'];
/** Status que pedem atenção da administradora. */
export const NEEDS_ADMIN: ContentStatus[] = ['changes_requested'];
/** Status visíveis no portal do cliente (rascunhos ficam ocultos). */
export const CLIENT_VISIBLE: ContentStatus[] = [
  'pending_approval',
  'approved',
  'changes_requested',
  'revised_pending',
  'scheduled',
  'published',
];

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const MEDIA_BUCKET = 'media';
export const SIGNED_URL_TTL = 60 * 60 * 3; // 3h
