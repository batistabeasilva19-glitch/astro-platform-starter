'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChevronDown, Copy, KeyRound, Trash2 } from 'lucide-react';
import { addPortalUser, deletePortalUser, resetPortalPassword, setLoginRequired } from '@/lib/actions/portal-auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { fmtDate } from '@/lib/utils';

export interface PortalUserRow { id: string; email: string; last_login_at: string | null }

const genPassword = () => {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
};

/** Login do cliente no portal: liga/desliga a exigência e gerencia os acessos (e-mail + senha). */
export const accessMessage = (name: string, url: string, email: string, password?: string) =>
  `${name}, esse link vai te acompanhar durante todo o nosso processo. Por ele, você poderá acessar tudo o que está sendo desenvolvido, acompanhar as informações do projeto, visualizar as alterações realizadas e fazer as aprovações de forma mais organizada.

🔗 Link de acesso: ${url}
📧 E-mail para login: ${email}
🔒 Senha: ${password ?? '[inserir senha]'}

Sempre que houver alguma atualização ou alteração, ela ficará registrada por aqui para você acompanhar com facilidade.

Guarde esse acesso, porque será o nosso espaço principal para aprovações e acompanhamento do projeto. ✨`;

export function PortalAccess({ clientId, clientName, url, required, users }: { clientId: string; clientName: string; url: string; required: boolean; users: PortalUserRow[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [open, setOpen] = useState(required);
  const key = `portal-access-open-${clientId}`;
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) setOpen(v === '1');
    } catch {}
  }, [key]);
  const toggle = () =>
    setOpen((o) => {
      try { localStorage.setItem(key, o ? '0' : '1'); } catch {}
      return !o;
    });
  const [shown, setShown] = useState<string | null>(null);
  // senhas só ficam conhecidas aqui logo depois de criadas/trocadas (no banco só existe o hash)
  const [known, setKnown] = useState<Record<string, string>>({});
  const copyMsg = (u: PortalUserRow) =>
    navigator.clipboard.writeText(accessMessage(clientName, url, u.email, known[u.id])).then(
      () => toast(known[u.id] ? 'Mensagem copiada ♡' : 'Mensagem copiada — troque [inserir senha] pela senha do cliente'),
      () => toast('Não foi possível copiar.', 'error'),
    );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? 'Algo deu errado.', 'error');
      else toast(okMsg);
    });

  return (
    <section className="card p-5 sm:p-6">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-wine" /> <span className="label text-wine/70">Login do cliente</span>
        </span>
        <span className="flex items-center gap-3">
          <span className={required ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800' : 'rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600'}>{required ? 'Exigido' : 'Só pelo link'}</span>
          <span className="flex items-center gap-1 text-xs text-wine">{open ? 'Minimizar' : 'Abrir'} <ChevronDown className={open ? 'size-4 rotate-180 transition' : 'size-4 transition'} /></span>
        </span>
      </button>

      {open && (
      <div className="mt-5 space-y-5">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={required} disabled={pending} onChange={(e) => run(() => setLoginRequired(clientId, e.target.checked), e.target.checked ? 'Login ativado ♡' : 'Login desativado')} className="mt-1 size-4 accent-[#771430]" />
          <span>
            Exigir e-mail e senha para entrar
            <span className="block text-xs text-ink/55">Com isso ligado, quem tem o link não vê nada sem fazer login. Crie ao menos um acesso abaixo antes de ativar.</span>
          </span>
        </label>

        {users.length > 0 && (
          <ul className="divide-y divide-wine/10 rounded-2xl border border-wine/15">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{u.email}</span>
                  <span className="block text-xs text-ink/50">{u.last_login_at ? `Último acesso: ${fmtDate(u.last_login_at.slice(0, 10), true)}` : 'Ainda não entrou'}</span>
                  {shown?.startsWith(u.id) && <span className="mt-1 block text-xs text-wine">Nova senha: <code className="select-all rounded bg-blush px-1.5 py-0.5">{shown.slice(u.id.length + 1)}</code> (anote e envie ao cliente)</span>}
                </span>
                <Button size="sm" variant="outline" onClick={() => copyMsg(u)}><Copy className="size-3.5" /> Copiar mensagem</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => { const p = genPassword(); start(async () => { const r = await resetPortalPassword(u.id, p); if (r.ok) { setShown(`${u.id}:${p}`); setKnown((k) => ({ ...k, [u.id]: p })); } else toast(r.error, 'error'); }); }}>Nova senha</Button>
                <button aria-label="Remover acesso" disabled={pending} onClick={() => confirm(`Remover o acesso de ${u.email}?`) && run(() => deletePortalUser(u.id), 'Acesso removido')} className="rounded-full p-2 text-wine/60 hover:bg-blush hover:text-wine"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await addPortalUser(clientId, email, password); if (r.ok) { setKnown((k) => ({ ...k, [r.id]: password })); setShown(null); setEmail(''); setPassword(''); } return r; }, 'Acesso criado ♡'); }}
        >
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail do cliente" required aria-label="E-mail do cliente" />
          <div className="flex gap-2">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha (mín. 8)" minLength={8} required aria-label="Senha" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setPassword(genPassword())}>Gerar</Button>
          </div>
          <Button type="submit" loading={pending}>Criar acesso</Button>
        </form>
        <p className="text-xs text-ink/50">Use “Copiar mensagem” para enviar ao cliente o texto pronto com nome, link, e-mail e senha. A senha é guardada criptografada: ela só aparece na mensagem logo depois de criada ou trocada — depois disso, gere uma “Nova senha”.</p>
      </div>
      )}
    </section>
  );
}
