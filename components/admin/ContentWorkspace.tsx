'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, History, Plus, Send, Trash2 } from 'lucide-react';
import type { ContentDetail } from '@/lib/types';
import { addAdminComment, changeStatus, createNewVersion, deleteContent, reactAdminComment, sendForApproval } from '@/lib/actions/content';
import { InstagramPost } from '@/components/content/InstagramPost';
import { CommentThread, HistoryList } from '@/components/content/Thread';
import { StatusBadge } from '@/components/content/Badges';
import { MediaManager } from './MediaManager';
import { EmailComposer, type EmailCtx } from '@/components/identity/EmailComposer';
import { WhatsAppComposer, type WhatsAppCtx } from './WhatsAppComposer';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';

interface Props {
  content: ContentDetail;
  ownerId: string;
  client: { id: string; handle: string; displayName: string; avatarUrl: string | null };
  /** slot com o formulário de dados (server → client children). */
  form: React.ReactNode;
  /** dados para o e-mail ao cliente (modelos editáveis). */
  email?: EmailCtx;
  /** dados para avisar no WhatsApp. */
  whatsapp?: WhatsAppCtx;
}

export function ContentWorkspace({ content, ownerId, client, form, email, whatsapp }: Props) {
  const current = content.versions.find((v) => v.version_number === content.current_version) ?? content.versions[content.versions.length - 1];
  const [selectedId, setSelectedId] = useState(current.id);
  const [slide, setSlide] = useState(0);
  const [modal, setModal] = useState<'version' | 'delete' | null>(null);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const selected = content.versions.find((v) => v.id === selectedId) ?? current;
  const isCurrent = selected.id === current.id;
  const pad = (n: number) => String(n).padStart(2, '0');
  const versionNumbers = Object.fromEntries(content.versions.map((v) => [v.id, v.version_number]));
  const visibleComments = content.comments;
  const slideCount = selected.media.filter((m) => m.kind === 'image').length;
  const canSend = ['draft', 'changes_requested'].includes(content.status);
  const newVersionSuggested = content.status === 'changes_requested' && content.current_version === current.version_number && !content.versions.some((v) => v.version_number > current.version_number);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
      toast(msg);
      after?.();
      router.refresh();
    });

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
      {/* ── coluna de edição ── */}
      <div className="space-y-8">
        <section className="card space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status={content.status} />
            <div className="flex flex-wrap gap-2">
              {whatsapp && <WhatsAppComposer key={`wa-${content.id}-${content.status}`} ctx={whatsapp} item={{ title: content.title, start: content.current_version > 1 && ['pending_approval', 'revised_pending'].includes(content.status) ? 'done' : ['approved', 'scheduled', 'published'].includes(content.status) ? 'approved' : 'awaiting' }} />}
              {email && <EmailComposer key={content.id + content.status} ctx={email} item={{ thing: `a postagem “${content.title}”`, short: content.title, approved: ['approved', 'scheduled', 'published'].includes(content.status) }} />}
              {canSend && (
                <Button size="sm" loading={pending} onClick={() => run(() => sendForApproval(content.id), 'Enviado para aprovação ♡')}>
                  <Send className="size-3.5" /> Enviar para aprovação
                </Button>
              )}
              {content.status === 'changes_requested' && (
                <Button size="sm" variant="outline" onClick={() => setModal('version')}>
                  <Plus className="size-3.5" /> Subir nova versão
                </Button>
              )}
              {content.status === 'approved' && (
                <Button size="sm" variant="dark" loading={pending} onClick={() => run(() => changeStatus(content.id, 'scheduled'), 'Marcado como programado')}>
                  <Check className="size-3.5" /> Marcar como programado
                </Button>
              )}
              {content.status === 'scheduled' && (
                <Button size="sm" variant="dark" loading={pending} onClick={() => run(() => changeStatus(content.id, 'published'), 'Marcado como publicado')}>
                  <Check className="size-3.5" /> Marcar como publicado
                </Button>
              )}
              {content.status !== 'changes_requested' && (
                <Button size="sm" variant="ghost" onClick={() => setModal('version')}>
                  <History className="size-3.5" /> Nova versão
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => setModal('delete')} aria-label="Excluir conteúdo">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          {content.approved_at && content.status === 'approved' && (
            <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
              ✓ Aprovado por <strong className="font-normal">{content.approved_by}</strong> em {fmtStamp(content.approved_at)}
            </p>
          )}
          {newVersionSuggested && (
            <p className="rounded-2xl border border-dashed border-wine/40 px-4 py-3 text-sm text-wine">
              O cliente pediu alteração. Crie uma <strong className="font-normal">nova versão</strong> para ajustar a arte sem perder a anterior e depois envie novamente.
            </p>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="h-display mb-5 text-2xl text-wine">Dados do conteúdo</h2>
          {form}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="h-display text-2xl text-wine">Artes e vídeos</h2>
            <VersionTabs versions={content.versions} currentId={current.id} selectedId={selected.id} onSelect={setSelectedId} />
          </div>
          <MediaManager ownerId={ownerId} clientId={client.id} contentId={content.id} format={content.format} version={selected} editable={isCurrent} />
        </section>

        <section className="card p-5 sm:p-6">
          <HistoryList history={content.history} />
        </section>
      </div>

      {/* ── coluna de preview e conversa ── */}
      <div className="space-y-8 xl:sticky xl:top-6 xl:self-start">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="label text-wine">Pré-visualização</h2>
            <span className={cn('rounded-full px-3 py-1 text-[0.7rem]', isCurrent ? 'bg-wine text-white' : 'border border-wine/30 text-wine')}>
              {isCurrent ? `Versão atual · ${pad(selected.version_number)}` : `Versão ${pad(selected.version_number)} (anterior)`}
            </span>
          </div>
          <InstagramPost handle={client.handle} displayName={client.displayName} avatarUrl={client.avatarUrl} format={content.format} version={selected} slideIndex={slide} onSlideChange={setSlide} />
          {selected.note && <p className="mx-auto mt-3 max-w-[470px] text-xs text-ink/60">Nota da versão: {selected.note}</p>}
        </section>

        <section className="card p-5 sm:p-6">
          <CommentThread
            comments={visibleComments}
            viewer="admin"
            slideCount={slideCount}
            slideIndex={slide}
            onPickSlide={(i) => setSlide(i)}
            versionNumbers={versionNumbers}
            onSend={(m, s, r) => addAdminComment(content.id, m, s, r)}
            onReact={reactAdminComment}
            canReply
          />
        </section>
      </div>

      <Modal open={modal === 'version'} onClose={() => setModal(null)} title="Criar nova versão">
        <p className="mb-4 text-sm text-ink/70">
          A Versão {pad(current.version_number + 1)} começa como cópia da atual (legenda e artes). As anteriores ficam guardadas e o cliente aprovará especificamente a nova.
        </p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="O que mudou? (opcional — o cliente vê esta nota)" />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button
            loading={pending}
            onClick={() =>
              run(() => createNewVersion(content.id, note), `Versão ${pad(current.version_number + 1)} criada`, () => {
                setModal(null);
                setNote('');
                setSelectedId('__latest__');
              })
            }
          >
            Criar versão {pad(current.version_number + 1)}
          </Button>
        </div>
      </Modal>

      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Excluir conteúdo?">
        <p className="mb-6 text-sm text-ink/70">O conteúdo, todas as versões, comentários e arquivos serão apagados. Não dá para desfazer.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteContent(content.id);
                if (!r.ok) return toast(r.error, 'error');
                toast('Conteúdo excluído');
                router.push(`/admin/clients/${client.id}`);
                router.refresh();
              })
            }
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function VersionTabs({ versions, currentId, selectedId, onSelect }: { versions: ContentDetail['versions']; currentId: string; selectedId: string; onSelect: (id: string) => void }) {
  if (versions.length < 2) return <span className="rounded-full bg-wine px-3 py-1 text-[0.7rem] text-white">Versão atual · 01</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...versions].reverse().map((v) => (
        <button
          key={v.id}
          onClick={() => onSelect(v.id)}
          className={cn('rounded-full border px-3 py-1 text-[0.72rem] transition', selectedId === v.id ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}
        >
          V{String(v.version_number).padStart(2, '0')}
          {v.id === currentId ? ' · atual' : ''}
        </button>
      ))}
    </div>
  );
}
