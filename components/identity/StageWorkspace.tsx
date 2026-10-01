'use client';

import { useState } from 'react';
import { Eye, EyeOff, History, Plus, Power, Send } from 'lucide-react';
import { addAdminIdentityComment, createStageVersion, sendStageForApproval, setFilesPublished, setStageEnabled } from '@/lib/actions/identity';
import { STAGE_BY_KEY, type CommentRowLike, type StageData } from '@/lib/identity/types';
import { CommentThread } from '@/components/content/Thread';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn, fmtStamp } from '@/lib/utils';
import { StageStatusBadge } from './ui';
import { ColorsEditor, ConceptEditor, FinalEditor, GalleryEditor, LogoEditor, MoodboardEditor, TypographyEditor, type EditorCtx } from './editors';
import { StageView } from './views';

export function StageWorkspace({ stage, ctx }: { stage: StageData; ctx: EditorCtx }) {
  const meta = STAGE_BY_KEY[stage.stage_key];
  const current = stage.versions.find((v) => v.version_number === stage.current_version) ?? stage.versions[stage.versions.length - 1];
  const [selectedId, setSelectedId] = useState(current.id);
  const [showPreview, setShowPreview] = useState(false);
  const [modal, setModal] = useState(false);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const selected = stage.versions.find((v) => v.id === selectedId) ?? current;
  const isCurrent = selected.id === current.id;
  const pad = (n: number) => String(n).padStart(2, '0');
  const isFiles = stage.stage_key === 'files';

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
      toast(msg);
      after?.();
      router.refresh();
    });

  if (!stage.enabled) {
    return (
      <div className="card flex flex-col items-center gap-4 border-dashed px-6 py-14 text-center">
        <Power className="size-6 text-wine/50" />
        <p className="h-display text-2xl text-wine">{meta.label} está desativada</p>
        <p className="max-w-md text-sm text-ink/60">Etapas desativadas não aparecem no portal do cliente nem contam no progresso.</p>
        <Button onClick={() => run(() => setStageEnabled(stage.id, true), 'Etapa ativada')} loading={pending}>Ativar etapa</Button>
      </div>
    );
  }

  const editorProps = { stage, version: selected, ctx, editable: isCurrent };
  const comments: CommentRowLike[] = stage.comments.map((c) => ({ ...c, content_id: c.project_id, slide_index: null }));
  const versionNumbers = Object.fromEntries(stage.versions.map((v) => [v.id, v.version_number]));

  return (
    <div className="space-y-8">
      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StageStatusBadge status={stage.status} version={stage.current_version} />
            <span className="text-xs text-ink/55">Versão {pad(stage.current_version)} · atualizada {fmtStamp(stage.updated_at)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {isFiles ? (
              stage.status === 'approved' ? (
                <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => setFilesPublished(stage.id, false), 'Arquivos despublicados')}>
                  <EyeOff className="size-3.5" /> Despublicar
                </Button>
              ) : (
                <Button size="sm" loading={pending} onClick={() => run(() => setFilesPublished(stage.id, true), 'Arquivos publicados ♡')}>
                  <Eye className="size-3.5" /> Publicar para o cliente
                </Button>
              )
            ) : (
              (stage.status === 'draft' || stage.status === 'changes_requested') && (
                <Button size="sm" loading={pending} onClick={() => run(() => sendStageForApproval(stage.id), 'Enviado para aprovação ♡')}>
                  <Send className="size-3.5" /> Enviar para aprovação
                </Button>
              )
            )}
            {!isFiles && (
              <Button size="sm" variant={stage.status === 'changes_requested' ? 'outline' : 'ghost'} onClick={() => setModal(true)}>
                {stage.status === 'changes_requested' ? <Plus className="size-3.5" /> : <History className="size-3.5" />} Nova versão
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => run(() => setStageEnabled(stage.id, false), 'Etapa desativada')} aria-label="Desativar etapa">
              <Power className="size-3.5" /> Desativar
            </Button>
          </div>
        </div>
        {stage.status === 'approved' && stage.approved_at && !isFiles && (
          <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">✓ Aprovado por <strong className="font-normal">{stage.approved_by}</strong> em {fmtStamp(stage.approved_at)}</p>
        )}
        {stage.status === 'changes_requested' && (
          <p className="rounded-2xl border border-dashed border-wine/40 px-4 py-3 text-sm text-wine">O cliente pediu alteração (veja os comentários abaixo). Crie uma <strong className="font-normal">nova versão</strong> para ajustar sem perder a anterior e envie novamente.</p>
        )}
        {stage.status === 'draft' && !isFiles && <p className="text-xs text-ink/55">Em criação: o cliente ainda não vê esta etapa. Quando estiver pronta, envie para aprovação.</p>}
        {isFiles && stage.status !== 'approved' && <p className="text-xs text-ink/55">Os arquivos só aparecem para o cliente depois de publicados.</p>}
      </section>

      <section className="card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-display text-2xl text-wine">{meta.number} — {meta.label}</h2>
          {stage.versions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {[...stage.versions].reverse().map((v) => (
                <button key={v.id} onClick={() => setSelectedId(v.id)} className={cn('rounded-full border px-3 py-1 text-[0.72rem] transition', selectedId === v.id ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>
                  V{pad(v.version_number)}{v.id === current.id ? ' · atual' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        {!isCurrent ? (
          <div>
            <p className="mb-5 rounded-2xl bg-blush/70 px-4 py-3 text-sm text-wine">Versão {pad(selected.version_number)} (anterior) — somente leitura. {selected.note && <>Nota: {selected.note}</>}</p>
            <StageView stage={stage} version={selected} />
          </div>
        ) : (
          <>
            {selected.note && <p className="mb-5 text-xs text-ink/55">Nota desta versão: {selected.note}</p>}
            <EditorFor {...editorProps} />
          </>
        )}
      </section>

      {isCurrent && (
        <section>
          <button onClick={() => setShowPreview((v) => !v)} className="mb-3 inline-flex items-center gap-2 text-sm text-wine underline-offset-4 hover:underline">
            {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {showPreview ? 'Ocultar' : 'Ver'} como o cliente vai enxergar
          </button>
          {showPreview && (
            <div className="rounded-[2rem] border border-wine/15 bg-blush-soft p-5 sm:p-8">
              <StageView stage={stage} version={current} />
            </div>
          )}
        </section>
      )}

      {!isFiles && (
        <section className="card p-5 sm:p-6">
          <CommentThread comments={comments as never} viewer="admin" versionNumbers={versionNumbers} onSend={(m) => addAdminIdentityComment(stage.id, m)} />
        </section>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Criar nova versão">
        <p className="mb-4 text-sm text-ink/70">
          A Versão {pad(stage.current_version + 1)} começa como cópia da atual. As anteriores ficam guardadas. A etapa volta para “Em criação” até você enviá-la de novo.
        </p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="O que mudou? (opcional)" />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button>
          <Button
            loading={pending}
            onClick={() =>
              run(() => createStageVersion(stage.id, note), `Versão ${pad(stage.current_version + 1)} criada`, () => {
                setModal(false);
                setNote('');
                setSelectedId('__latest__');
              })
            }
          >
            Criar versão {pad(stage.current_version + 1)}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function EditorFor(props: { stage: StageData; version: StageData['versions'][number]; ctx: EditorCtx; editable: boolean }) {
  // `key` recria o editor ao trocar de versão/etapa (estado local do formulário)
  const key = `${props.stage.id}-${props.version.id}`;
  switch (props.stage.stage_key) {
    case 'concept':
      return <ConceptEditor key={key} {...props} />;
    case 'moodboard':
      return <MoodboardEditor key={key} {...props} />;
    case 'logo':
      return <LogoEditor key={key} {...props} />;
    case 'colors':
      return <ColorsEditor key={key} {...props} />;
    case 'typography':
      return <TypographyEditor key={key} {...props} />;
    case 'final':
      return (
        <div key={key} className="space-y-8">
          <FinalEditor {...props} />
        </div>
      );
    case 'files':
      return <GalleryEditor key={key} {...props} files />;
    default:
      return <GalleryEditor key={key} {...props} />;
  }
}

