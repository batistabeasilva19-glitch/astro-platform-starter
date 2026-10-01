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

const MAX_SIDE = 2160; // 2160 px cobre feed, carrossel e story em alta qualidade

/**
 * Artes de design costumam vir enormes (4000+ px). Para POSTS reduz o maior lado para 2160 px e salva em JPEG
 * (qualidade 0,9): fica nítido, mas carrega rápido e não estoura a memória do navegador de quem abre.
 * Só mexe em imagens grandes; GIF/SVG e imagens já pequenas ficam intactas. Se algo falhar, devolve o original.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const big = Math.max(bmp.width, bmp.height);
    if (big <= MAX_SIDE && file.size <= 3 * 1024 * 1024) {
      bmp.close();
      return file;
    }
    const k = Math.min(1, MAX_SIDE / big);
    const w = Math.round(bmp.width * k);
    const h = Math.round(bmp.height * k);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
