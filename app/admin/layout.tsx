import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { requireUser } from '@/lib/data/clients';
import { signOut } from '@/lib/actions/auth';
import { Logo } from '@/components/brand/Brand';
import { NavLinks } from '@/components/admin/NavLinks';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop: barra lateral vinho, como o fundo da identidade */}
      <aside className="relative hidden overflow-hidden bg-wine p-6 text-white lg:flex lg:flex-col">
        <Link href="/admin" aria-label="Início">
          <Logo tone="light" withTagline className="w-full" />
        </Link>
        <div className="mt-10">
          <NavLinks orientation="vertical" />
        </div>
        <div className="relative mt-auto pt-10">
          <p className="mb-3 truncate text-xs text-white/60">{user.email}</p>
          <form action={signOut}>
            <button className="flex items-center gap-2 text-sm text-white/80 transition hover:text-white">
              <LogOut className="size-4" /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile: barra superior */}
      <header className="sticky top-0 z-30 bg-wine px-4 pb-3 pt-3 text-white lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/admin">
            <Logo tone="light" className="w-24" />
          </Link>
          <form action={signOut}>
            <button aria-label="Sair" className="rounded-full p-2 text-white/80 hover:bg-white/10">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
        <NavLinks orientation="horizontal" />
      </header>

      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
    </div>
  );
}
