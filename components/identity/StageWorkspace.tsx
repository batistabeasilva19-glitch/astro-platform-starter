'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, EyeOff, History, MessageSquareText, Plus, Power, Send, Trash2 } from 'lucide-react';
import { addAdminIdentityComment, createStageVersion, deleteAnnotation, sendStageForApproval, setStageEnabled, setStageStatus } from '@/lib/actions/identity';
import { BRIEFING_STATUS_LABEL, STAGE_BY_KEY, STAGE_STATUS_META, type StageStatus, type CommentRowLike, type IdentityDetail, type SignedAsset, type StageData } from '@/lib/identity/types';
import { CommentThread } from '@/components/content/Thread';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';
import { StageStatusBadge } from './ui';
import { EmailComposer, type EmailCtx } from './EmailComposer';
import { STAGES } from '@/lib/identity/types';
import { BriefingEditor, ColorsEditor, ConceptEditor, FinalEditor, GalleryEditor, LogoEditor, MoodboardEditor, TypographyEditor, type EditorCtx } from './editors';
import { StageView } from './views';
import type { ViewCtx } from './view-context';

function stageItem(all: { stage_key: string; enabled: boolean }[], stage: StageData) {
  const i = STAGES.findIndex((m) => m.key === stage.stage_key);
  const label = STAGES[i]?.label ?? '';
  const next = STAGES.slice(i + 1).find((m) => m.approvable && all.some((x) => x.stage_key === m.key && x.enabled));
  return { thing: `a etapa “${label}”`, short: label, next: next?.label ?? null, approved: stage.status === 'approved' };
}

export function StageWorkspace({ stage, ctx, detail, email }: { stage: StageData; ctx: EditorCtx; detail: IdentityDetail; email?: EmailCtx & { stages: { stage_key: string; enabled: boolean }[] } }) {
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
  const isFiles = stage.stage_key === 'files';
  const isLogo = stage.stage_key === 'logo';
  const isFinal = stage.stage_key === 'final';
  const isBriefing = stage.stage_key === 'briefing';
  const pad = (n: number) => String(n).padStart(2, '0');

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

  const viewCtx = (s: StageData): ViewCtx => ({ mode: 'admin', stage: s, allStages: detail.stages, favorites: detail.favorites, selections: detail.selections, annotations: detail.annotations });
  const editorProps = { stage, version: selected, ctx, editable: isCurrent, favorites: detail.favorites, downloads: detail.downloads };
  const comments: CommentRowLike[] = stage.comments.map((c) => ({ ...c, content_id: c.project_id, slide_index: null }));
  const versionNumbers = Object.fromEntries(stage.versions.map((v) => [v.id, v.version_number]));

  // comentários presos a imagens desta etapa
  const assets: SignedAsset[] = [...stage.versions.flatMap((v) => v.assets), ...stage.proposals.flatMap((p) => p.versions.flatMap((v) => v.assets))];
  const marks = detail.annotations.filter((a) => a.stage_id === stage.id);

  return (
    <div className="space-y-8">
      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {!isFiles && <StageStatusBadge status={stage.status} version={stage.current_version} stageKey={stage.stage_key} />}
            {!isLogo && !isFiles && !isBriefing && <span className="text-xs text-ink/55">Versão {pad(stage.current_version)} · atualizada {fmtStamp(stage.updated_at)}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {email && !isFiles && <EmailComposer key={stage.id + stage.status} ctx={email} item={stageItem(email.stages, stage)} />}
            {isBriefing && (
              <a href={`/admin/identidades/${ctx.projectId}/briefing/pdf`} className="inline-flex items-center gap-2 rounded-full border border-wine px-4 py-1.5 text-[0.78rem] text-wine transition hover:bg-wine hover:text-white">
                <Download className="size-3.5" /> Baixar formulário (PDF)
              </a>
            )}
            {!isFiles && !isFinal && (stage.status === 'draft' || stage.status === 'changes_requested') && (
              <Button size="sm" loading={pending} onClick={() => run(() => sendStageForApproval(stage.id), isBriefing ? 'Formulário enviado ao cliente ♡' : 'Enviado para aprovação ♡')}>
                <Send className="size-3.5" /> {isBriefing ? 'Enviar formulário ao cliente' : 'Enviar para aprovação'}
              </Button>
            )}
            {!isFiles && !isLogo && !isFinal && !isBriefing && (
              <Button size="sm" variant={stage.status === 'changes_requested' ? 'outline' : 'ghost'} onClick={() => setModal(true)}>
                {stage.status === 'changes_requested' ? <Plus className="size-3.5" /> : <History className="size-3.5" />} Nova versão
              </Button>
            )}
            {meta.approvable && !isFiles && (
              <Select
                aria-label="Alterar status manualmente"
                title="Alterar status manualmente"
                value={stage.status}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.value as StageStatus;
                  const label = isBriefing ? BRIEFING_STATUS_LABEL[next].admin : STAGE_STATUS_META[next].label;
                  if (confirm(`Alterar o status desta etapa para “${label}”? ${next === 'approved' ? 'Ela será registrada como aprovada manualmente por você.' : next === 'awaiting' ? 'O cliente passa a ver esta etapa para aprovar.' : ''}`)) run(() => setStageStatus(stage.id, next), 'Status atualizado ♡');
                }}
                className="!w-auto !py-1.5 text-[0.78rem]"
              >
                {(['draft', 'awaiting', 'changes_requested', 'approved'] as StageStatus[]).map((st) => (
                  <option key={st} value={st}>{isBriefing ? BRIEFING_STATUS_LABEL[st].admin : STAGE_STATUS_META[st].label}</option>
                ))}
              </Select>
            )}
            <Button size="sm" variant="ghost" onClick={() => run(() => setStageEnabled(stage.id, false), 'Etapa desativada')} aria-label="Desativar etapa">
              <Power className="size-3.5" /> Desativar
            </Button>
          </div>
        </div>
        {stage.status === 'approved' && stage.approved_at && !isFiles && (
          <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">✓ {isBriefing ? 'Respondido' : 'Aprovado'} por <strong className="font-normal">{stage.approved_by}</strong> em {fmtStamp(stage.approved_at)}</p>
        )}
        {isBriefing && stage.status === 'approved' && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-wine/20 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 text-ink/70">🔒 O formulário está <strong className="font-normal text-wine">travado</strong> para o cliente. Ele só volta a editar se você liberar.</span>
            <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => setStageStatus(stage.id, 'awaiting'), 'Edição liberada ao cliente ♡')}>Liberar edição ao cliente</Button>
          </div>
        )}
        {stage.status === 'changes_requested' && (
          <p className="rounded-2xl border border-dashed border-wine/40 px-4 py-3 text-sm text-wine">
            O cliente pediu alteração (veja os comentários abaixo). {isLogo ? <>Crie uma <strong className="font-normal">nova versão</strong> dentro da proposta</> : <>Crie uma <strong className="font-normal">nova versão</strong> para ajustar sem perder a anterior</>} e envie novamente.
          </p>
        )}
        {stage.status === 'draft' && !isFiles && !isFinal && <p className="text-xs text-ink/55">Em criação: o cliente ainda não vê esta etapa. {isBriefing ? 'Envie o formulário quando quiser que ele responda.' : 'Quando estiver pronta, envie para aprovação.'}</p>}
        {isBriefing && stage.status === 'awaiting' && <p className="text-xs text-ink/55">O cliente já pode responder pelo link dele. Você acompanha as respostas aqui; elas salvam sozinhas enquanto ele preenche.</p>}
        {isFinal && <p className="text-xs text-ink/55">A aprovação final é liberada sozinha quando todas as outras etapas ativas forem aprovadas.</p>}
      </section>

      <section className="card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-display text-2xl text-wine">{meta.number} — {meta.label}</h2>
          {!isLogo && stage.versions.length > 1 && (
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
            <StageView ctx={viewCtx(stage)} version={selected} />
          </div>
        ) : (
          <>
            {selected.note && <p className="mb-5 text-xs text-ink/55">Nota desta versão: {selected.note}</p>}
            <EditorFor key={`${stage.id}-${selected.id}`} {...editorProps} />
          </>
        )}
      </section>

      {marks.length > 0 && (
        <section className="card p-5 sm:p-6">
          <h3 className="label mb-4 flex items-center gap-2 text-wine"><MessageSquareText className="size-4" /> Comentários nas imagens</h3>
          <ul className="space-y-3">
            {marks.map((a) => {
              const asset = assets.find((x) => x.id === a.asset_id);
              return (
                <li key={a.id} className="flex gap-3 rounded-2xl border border-wine/15 p-3">
                  {asset && isImg(asset) ? <img loading="lazy" decoding="async" src={asset.url} alt="" className="size-14 shrink-0 rounded-xl bg-blush object-cover" /> : <span className="size-14 shrink-0 rounded-xl bg-blush" />}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="label mb-0.5 text-wine">
                      {a.number ? `Marcador ${a.number} · ` : 'Geral · '}
                      {a.author_type === 'client' ? 'Cliente' : 'Soltria'} · {a.author_name}
                    </p>
                    <p className="whitespace-pre-line">{a.message}</p>
                    <p className="mt-1 text-[0.68rem] text-ink/45">{fmtStamp(a.created_at)}{asset ? ` · ${asset.name || asset.file_name}` : ''}</p>
                  </div>
                  <button aria-label="Excluir comentário" onClick={() => run(() => deleteAnnotation(a.id), 'Comentário excluído')} className="self-start rounded-full p-1.5 text-wine/60 transition hover:bg-blush hover:text-wine"><Trash2 className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!isFiles && (
        <section>
          <button onClick={() => setShowPreview((v) => !v)} className="mb-3 inline-flex items-center gap-2 text-sm text-wine underline-offset-4 hover:underline">
            {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {showPreview ? 'Ocultar' : 'Ver'} como o cliente vai enxergar
          </button>
          {showPreview && (
            <div className="rounded-[2rem] border border-wine/15 bg-blush-soft p-5 sm:p-8">
              <StageView ctx={viewCtx(stage)} version={current} />
            </div>
          )}
        </section>
      )}

      {!isFiles && !isBriefing && (
        <section className="card p-5 sm:p-6">
          <CommentThread comments={comments as never} viewer="admin" versionNumbers={versionNumbers} onSend={(m) => addAdminIdentityComment(stage.id, m)} />
        </section>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Criar nova versão">
        <p className="mb-4 text-sm text-ink/70">A Versão {pad(stage.current_version + 1)} começa como cópia da atual. As anteriores ficam guardadas. A etapa volta para “Em criação” até você enviá-la de novo.</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="O que mudou? (opcional — o cliente vê esta nota)" />
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

const isImg = (a: SignedAsset) => (a.mime_type ?? '').startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(a.file_name || a.storage_path);

function EditorFor(props: { stage: StageData; version: StageData['versions'][number]; ctx: EditorCtx; editable: boolean; favorites: IdentityDetail['favorites']; downloads: IdentityDetail['downloads'] }) {
  switch (props.stage.stage_key) {
    case 'briefing':
      return <BriefingEditor {...props} />;
    case 'concept':
      return <ConceptEditor {...props} />;
    case 'moodboard':
      return <MoodboardEditor {...props} />;
    case 'logo':
      return <LogoEditor {...props} />;
    case 'colors':
      return <ColorsEditor {...props} />;
    case 'typography':
      return <TypographyEditor {...props} />;
    case 'elements':
      return <GalleryEditor {...props} mode="elements" />;
    case 'applications':
      return <GalleryEditor {...props} mode="applications" />;
    case 'final':
      return <FinalEditor {...props} />;
    case 'files':
      return <GalleryEditor {...props} mode="files" />;
  }
}
