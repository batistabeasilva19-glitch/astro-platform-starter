'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STAGES, STAGE_BY_KEY, type StageKey, type StageStatus } from '@/lib/identity/types';
import { cn } from '@/lib/utils';

/** Menu do portal: rolagem horizontal com alvos de toque grandes (pensado para o WhatsApp/celular). */
export function PortalNav({ token, stages, projectApproved }: { token: string; stages: { stage_key: StageKey; status: StageStatus }[]; projectApproved: boolean }) {
  const path = usePathname();
  const base = `/brand/review/${token}`;
  const has = new Set(stages.map((s) => s.stage_key));
  const items = [
    { href: base, label: 'Visão geral', active: path === base },
    ...STAGES.filter((m) => has.has(m.key) && (m.key !== 'files' || projectApproved)).map((m) => ({
      href: `${base}/${m.key}`,
      label: m.key === 'final' ? 'Finalização' : m.key === 'files' ? 'Arquivos' : m.short,
      active: path === `${base}/${m.key}`,
      status: stages.find((s) => s.stage_key === m.key)?.status,
      approvable: STAGE_BY_KEY[m.key].approvable,
    })),
    { href: `${base}/favoritos`, label: '♡ Favoritos', active: path === `${base}/favoritos` },
  ];
  return (
    <nav aria-label="Etapas" className="sticky top-0 z-30 border-b border-wine/10 bg-blush-soft/90 backdrop-blur">
      <ul className="no-scrollbar mx-auto flex max-w-5xl snap-x gap-1.5 overflow-x-auto px-4 py-2.5">
        {items.map((i) => (
          <li key={i.href} className="shrink-0 snap-start">
            <Link href={i.href} aria-current={i.active ? 'page' : undefined} className={cn('inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-[0.8rem] transition', i.active ? 'border-wine bg-wine text-white' : 'border-wine/20 text-wine hover:bg-blush')}>
              {'status' in i && i.approvable && <span className={cn('text-[0.7rem]', i.active ? 'text-white' : 'text-wine')}>{i.status === 'approved' ? '✓' : i.status === 'draft' ? '○' : '●'}</span>}
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
