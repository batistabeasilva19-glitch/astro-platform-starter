'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, KanbanSquare, LayoutDashboard, Palette, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnread } from './unread-store';

const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/notificacoes', label: 'Notificações', icon: Bell, badge: true },
  { href: '/admin/clients', label: 'Clientes', icon: Users },
  { href: '/admin/content', label: 'Conteúdos', icon: CalendarDays },
  { href: '/admin/producao', label: 'Produção', icon: KanbanSquare },
  { href: '/admin/identidades', label: 'Identidade Visual', icon: Palette },
];

export function NavLinks({ orientation, unread = 0 }: { orientation: 'vertical' | 'horizontal'; unread?: number }) {
  const path = usePathname();
  const count = useUnread(unread);
  return (
    <nav className={cn('flex gap-1', orientation === 'vertical' ? 'flex-col' : 'items-center overflow-x-auto no-scrollbar')}>
      {LINKS.map(({ href, label, icon: Icon, exact, badge }) => {
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
            {badge && count > 0 && <span className={cn('ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] font-medium tabular-nums', active ? 'bg-wine text-white' : 'bg-white text-wine')} aria-label={`${count} novidades`}>{count > 99 ? '99+' : count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
