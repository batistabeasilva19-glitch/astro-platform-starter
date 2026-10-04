'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CheckCheck } from 'lucide-react';
import { markNotificationsRead } from '@/lib/actions/notifications';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { setUnread } from './unread-store';

export function NotificationActions({ unread }: { unread: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default');
  useEffect(() => setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission), []);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={unread === 0} loading={pending} onClick={() => start(async () => { await markNotificationsRead(); setUnread(0); toast('Tudo marcado como lido ♡'); router.refresh(); })}>
        <CheckCheck className="size-3.5" /> Marcar tudo como lido
      </Button>
      {perm === 'default' && (
        <Button size="sm" variant="ghost" onClick={async () => setPerm(await Notification.requestPermission())}><BellRing className="size-3.5" /> Avisar no navegador</Button>
      )}
      {perm === 'granted' && <span className="text-xs text-emerald-700">Avisos do navegador ativados</span>}
      {perm === 'denied' && <span className="text-xs text-ink/50">Avisos bloqueados no navegador</span>}
    </div>
  );
}
