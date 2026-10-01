import 'server-only';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/constants';

/**
 * Endereço público do site. Usa o domínio pelo qual a administradora está
 * acessando o painel (sempre correto, mesmo trocando de projeto/domínio na Vercel);
 * NEXT_PUBLIC_SITE_URL fica como reserva.
 */
export async function getSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  } catch {
    // fora de uma requisição
  }
  return SITE_URL;
}
