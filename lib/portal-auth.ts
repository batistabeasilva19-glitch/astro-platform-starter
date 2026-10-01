import 'server-only';
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

/** Login do cliente no portal: senha com scrypt + cookie assinado (HMAC). Sem dependências novas. */

const DAYS = 30;
const secret = () => process.env.PORTAL_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const cookieName = (clientId: string) => `cp_${clientId.slice(0, 12)}`;
const hmac = (data: string) => createHmac('sha256', secret()).update(data).digest('hex');
const derive = (password: string, salt: Buffer) => new Promise<Buffer>((res, rej) => scrypt(password, salt, 64, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const a = await derive(password, Buffer.from(saltHex, 'hex'));
  const b = Buffer.from(hashHex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O cookie depende do hash da senha: trocar a senha derruba as sessões antigas. */
const sign = (clientId: string, userId: string, exp: number, passwordHash: string) => hmac(`${clientId}.${userId}.${exp}.${passwordHash.slice(-24)}`);

export async function startPortalSession(clientId: string, userId: string, passwordHash: string) {
  const exp = Date.now() + DAYS * 86_400_000;
  (await cookies()).set(cookieName(clientId), `${userId}.${exp}.${sign(clientId, userId, exp, passwordHash)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DAYS * 86_400,
  });
}

export async function endPortalSession(clientId: string) {
  (await cookies()).delete(cookieName(clientId));
}

/** O visitante tem uma sessão válida de login para este cliente? */
export async function hasPortalSession(clientId: string): Promise<boolean> {
  const raw = (await cookies()).get(cookieName(clientId))?.value;
  if (!raw) return false;
  const [userId, expStr, mac] = raw.split('.');
  const exp = Number(expStr);
  if (!userId || !mac || !Number.isFinite(exp) || exp < Date.now()) return false;
  const { data } = await createAdminClient().from('client_portal_users').select('password_hash').eq('id', userId).eq('client_id', clientId).maybeSingle();
  if (!data) return false;
  const want = Buffer.from(sign(clientId, userId, exp, data.password_hash as string));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got);
}
