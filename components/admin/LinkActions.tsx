'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, Link2, RefreshCw, ShieldOff } from 'lucide-react';
import { regenerateLink, setLinkActive } from '@/lib/actions/clients';
import { Button, buttonClass } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/** "Copiar link de aprovação" + abrir, gerar novo e revogar. */
type LinkResult = { ok: boolean; error?: string };

/**
 * `regenerate` / `setActive` são opcionais: sem eles, atua sobre o link de aprovação de conteúdo do cliente
 * (comportamento original). O módulo Identidade Visual passa as próprias ações.
 */
export function LinkActions({
  clientId,
  url,
  active,
  regenerate = () => regenerateLink(clientId),
  setActive = (v: boolean) => setLinkActive(clientId, v),
}: {
  clientId: string;
  url: string;
  active: boolean;
  regenerate?: () => Promise<LinkResult>;
  setActive?: (active: boolean) => Promise<LinkResult>;
}) {
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<'regen' | 'revoke' | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement('textarea');
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    toast('Link de aprovação copiado ♡');
    setTimeout(() => setCopied(false), 2200);
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      setConfirm(null);
      if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
      toast(okMsg);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active ? (
        <>
          <Button onClick={copy}>
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            Copiar link de aprovação
          </Button>
          <a href={url} target="_blank" rel="noreferrer" className={buttonClass('outline')}>
            <ExternalLink className="size-4" /> Ver como cliente
          </a>
          <Button variant="ghost" size="sm" onClick={() => setConfirm('regen')}>
            <RefreshCw className="size-3.5" /> Novo link
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm('revoke')}>
            <ShieldOff className="size-3.5" /> Revogar
          </Button>
        </>
      ) : (
        <>
          <span className="rounded-full border border-dashed border-wine px-4 py-2 text-xs text-wine">Link revogado — o cliente não consegue acessar</span>
          <Button onClick={() => run(() => setActive(true), 'Link reativado')} loading={pending}>
            Reativar link
          </Button>
          <Button variant="outline" onClick={() => setConfirm('regen')}>
            Gerar novo link
          </Button>
        </>
      )}

      <Modal open={confirm === 'regen'} onClose={() => setConfirm(null)} title="Gerar um novo link?">
        <p className="mb-6 text-sm text-ink/70">O link anterior deixa de funcionar imediatamente. Você precisará enviar o novo link para o cliente.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button onClick={() => run(() => regenerate(), 'Novo link gerado')} loading={pending}>Gerar novo link</Button>
        </div>
      </Modal>
      <Modal open={confirm === 'revoke'} onClose={() => setConfirm(null)} title="Revogar o link?">
        <p className="mb-6 text-sm text-ink/70">O cliente não conseguirá mais abrir o portal com este link. Você pode reativá-lo quando quiser.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button onClick={() => run(() => setActive(false), 'Link revogado')} loading={pending}>Revogar link</Button>
        </div>
      </Modal>
    </div>
  );
}
