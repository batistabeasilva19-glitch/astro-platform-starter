'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { setUnread, useUnread } from './unread-store';

/** Consulta novidades a cada 45 s: atualiza o sino, o título da aba e avisa quando chegar algo novo. */
export function NotificationWatcher({ initial }: { initial: number }) {
  const toast = useToast();
  const router = useRouter();
  const unread = useUnread(initial);
  const prev = useRef(initial);

  useEffect(() => {
    setUnread(initial);
    prev.current = initial;
  }, [initial]);

  useEffect(() => {
    let dead = false;
    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const r = await fetch('/api/admin/notificacoes', { cache: 'no-store' });
        if (!r.ok || dead) return;
        const j = (await r.json()) as { unread: number; latest: { who: string; client: string; detail: string; href: string } | null };
        if (j.unread > prev.current && j.latest) {
          const text = `${j.latest.client}: ${j.latest.detail}`;
          toast(text);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try { new Notification('Soltria · novidade do cliente', { body: text }).onclick = () => { window.focus(); router.push(j.latest!.href); }; } catch {}
          }
        }
        prev.current = j.unread;
        setUnread(j.unread);
      } catch {}
    };
    const t = setInterval(check, 45_000);
    document.addEventListener('visibilitychange', check);
    return () => { dead = true; clearInterval(t); document.removeEventListener('visibilitychange', check); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (3) no título da aba
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread]);

  return null;
}
