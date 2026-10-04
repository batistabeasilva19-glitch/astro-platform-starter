import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchNotifications, lastSeen, unreadCount } from '@/lib/data/notifications';

export const dynamic = 'force-dynamic';

/** Contagem leve de novidades (e a mais recente), consultada de tempos em tempos pelo sino. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ unread: 0 }, { status: 401 });
  const unread = await unreadCount(supabase);
  let latest: { who: string; client: string; detail: string; href: string } | null = null;
  if (unread > 0) {
    const since = await lastSeen();
    const n = (await fetchNotifications(supabase, 1))[0];
    if (n && n.at > since) latest = { who: n.who, client: n.client, detail: n.detail, href: n.href };
  }
  return NextResponse.json({ unread, latest });
}
