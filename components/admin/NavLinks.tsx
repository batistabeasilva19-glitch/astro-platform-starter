'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, KanbanSquare, LayoutDashboard, Palette, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/clients', label: 'Clientes', icon: Users },
  { href: '/admin/content', label: 'Conteúdos', icon: CalendarDays },
  { href: '/admin/producao', label: 'Produção', icon: KanbanSquare },
  { href: '/admin/identidades', label: 'Identidade Visual', icon: Palette },
];

export function NavLinks({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const path = usePathname();
  return (
    <nav className={cn('flex gap-1', orientation === 'vertical' ? 'flex-col' : 'items-center overflow-x-auto no-scrollbar')}>
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.85rem] tracking-wide transition',
              active ? 'bg-white text-wine' : 'text-white/80 hover:bg-white/10 hover:text-white',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
