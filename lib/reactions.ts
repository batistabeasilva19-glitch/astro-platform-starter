import type { Reaction } from '@/lib/types';

/** Emojis disponíveis para reagir a um comentário. */
export const REACTION_EMOJIS = ['👀', '👍', '❤️', '✅', '🙏', '😍', '🎉', '✨'] as const;

export const cleanReactions = (raw: unknown): Reaction[] =>
  Array.isArray(raw)
    ? raw.filter((r): r is Reaction => !!r && typeof r === 'object' && (REACTION_EMOJIS as readonly string[]).includes((r as Reaction).emoji) && ((r as Reaction).by === 'admin' || (r as Reaction).by === 'client')).slice(0, 40)
    : [];

/** Liga/desliga a reação de quem reagiu (cada pessoa, um emoji uma vez). */
export function toggleReaction(list: Reaction[], emoji: string, by: Reaction['by']): Reaction[] {
  const has = list.some((r) => r.emoji === emoji && r.by === by);
  return has ? list.filter((r) => !(r.emoji === emoji && r.by === by)) : [...list, { emoji, by }];
}
