import Link from 'next/link';
import { CalendarDays, Grid3x3, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export type View = 'calendar' | 'list' | 'feed';
const OPTIONS: { id: View; label: string; icon: typeof List }[] = [
  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'feed', label: 'Feed', icon: Grid3x3 },
];

export const parseView = (v: string | undefined, fallback: View = 'calendar'): View =>
  v === 'calendar' || v === 'list' || v === 'feed' ? v : fallback;

/** Alternador Calendário · Lista · Feed (usa ?view= na URL, funciona sem JS). */
export function ViewTabs({ basePath, current }: { basePath: string; current: View }) {
  return (
    <div className="inline-flex rounded-full border border-wine/25 bg-white p-1" role="tablist">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          href={`${basePath}?view=${id}`}
          role="tab"
          aria-selected={current === id}
          scroll={false}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2 text-[0.8rem] transition',
            current === id ? 'bg-wine text-white' : 'text-wine hover:bg-blush',
          )}
        >
          <Icon className="size-4" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{label}</span>
        </Link>
      ))}
    </div>
  );
}
