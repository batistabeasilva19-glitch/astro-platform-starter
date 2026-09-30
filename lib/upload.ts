'use client';

import { createClient } from '@/lib/supabase/client';
import { MEDIA_BUCKET } from '@/lib/constants';

export const MAX_IMAGE_MB = 20;
export const MAX_VIDEO_MB = 200;

/** Envia direto do navegador para o Storage (sessão da administradora + RLS de pasta). */
export async function uploadToStorage(file: File, folder: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '3600',
  });
  if (error) throw new Error(error.message.includes('exceeded') ? 'Arquivo maior que o limite do seu plano Supabase.' : error.message);
  return path;
}

export function validateFile(file: File, kind: 'image' | 'video'): string | null {
  if (kind === 'image' && !file.type.startsWith('image/')) return `"${file.name}" não é uma imagem.`;
  if (kind === 'video' && !file.type.startsWith('video/')) return `"${file.name}" não é um vídeo.`;
  const max = (kind === 'image' ? MAX_IMAGE_MB : MAX_VIDEO_MB) * 1024 * 1024;
  if (file.size > max) return `"${file.name}" é maior que ${kind === 'image' ? MAX_IMAGE_MB : MAX_VIDEO_MB} MB.`;
  return null;
}

export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}
