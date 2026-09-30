import Link from 'next/link';
import { Logo } from '@/components/brand/Brand';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-wine px-6 text-center text-white">
      <Logo tone="light" className="w-56" />
      <h1 className="script mt-8 text-5xl">Página não encontrada</h1>
      <p className="mt-3 max-w-sm text-sm text-white/80">O endereço pode estar incorreto ou o conteúdo não está mais disponível.</p>
      <Link href="/" className="mt-8 rounded-full border border-white/60 px-6 py-2.5 text-sm transition hover:bg-white hover:text-wine">Voltar ao início</Link>
    </main>
  );
}
