'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { portalLogout, type PortalKind } from '@/lib/actions/portal-auth';

export function LogoutButton({ token, kind = 'portal' }: { token: string; kind?: PortalKind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await portalLogout(kind, token); router.refresh(); })}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/10 disabled:opacity-60"
    >
      <LogOut className="size-3.5" /> Sair
    </button>
  );
}
