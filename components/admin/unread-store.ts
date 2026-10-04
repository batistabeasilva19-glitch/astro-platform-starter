'use client';

import { useSyncExternalStore } from 'react';

/** Contagem de novidades compartilhada entre o menu (computador e celular), o aviso e a página. */
let count: number | null = null;
const subs = new Set<() => void>();
export const setUnread = (n: number) => {
  if (count === n) return;
  count = n;
  subs.forEach((f) => f());
};
export function useUnread(initial: number): number {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => count ?? initial,
    () => initial,
  );
}
