'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, GripVertical, ImagePlus, Loader2, Plus, Save, Trash2, UploadCloud } from 'lucide-react';
import {
  addLogoProposal,
  registerIdentityAsset,
  removeIdentityAsset,
  removeLogoProposal,
  reorderIdentityAssets,
  saveStageContent,
  updateIdentityAssetCaption,
  updateLogoProposal,
} from '@/lib/actions/identity';
import { CONCEPT_FIELDS, LOGO_SLOTS, newId, type ColorItem, type FontItem, type ProposalData, type SignedAsset, type StageContent, type StageData, type VersionData } from '@/lib/identity/types';
import { uploadToStorage, validateFile } from '@/lib/upload';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export interface EditorCtx {
  ownerId: string;
  clientId: string;
  projectId: string;
}
interface EditorProps {
  stage: StageData;
  version: VersionData;
  ctx: EditorCtx;
  editable: boolean;
}

const MAX_FILE_MB = 50;

/** Salvar / enviar com toast + atualização da página. */
function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
      if (okMsg) toast(okMsg);
      router.refresh();
    });
  return { pending, run, toast, router };
}

function useContentState(stage: StageData, version: VersionData) {
  const [content, setContent] = useState<StageContent>(version.content ?? {});
  const [dirty, setDirty] = useState(false);
  const { pending, run } = useRun();
  const set = (patch: Partial<StageContent>) => {
    setContent((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const save = () => run(() => saveStageContent(stage.id, content), 'Alterações salvas ♡');
  return { content, set, dirty, setDirty, save, saving: pending };
}

function SaveBar({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      {dirty && <span className="text-xs text-ink/55">Alterações não salvas</span>}
      <Button onClick={onSave} loading={saving} disabled={!dirty}>
        <Save className="size-4" /> Salvar
      </Button>
    </div>
  );
}

// ─── 01 Conceito ───────────────────────────────────────────────────────────
export function ConceptEditor({ stage, version, ctx, editable }: EditorProps) {
  const s = useContentState(stage, version);
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {CONCEPT_FIELDS.map(([k, label]) => (
          <Field key={k} label={label} className={k === 'description' || k === 'manifesto' ? 'sm:col-span-2' : ''}>
            <Textarea rows={k === 'keywords' ? 2 : 4} value={s.content[k] ?? ''} disabled={!editable} onChange={(e) => s.set({ [k]: e.target.value })} placeholder={k === 'keywords' ? 'Separe por vírgula: elegância, ousadia, afeto' : undefined} />
          </Field>
        ))}
      </div>
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      <div className="mt-8">
        <p className="label mb-3 text-wine">Imagens do conceito</p>
        <AssetGrid ctx={ctx} stage={stage} version={version} assets={version.assets} editable={editable} />
      </div>
    </div>
  );
}

// ─── 02 Moodboard ──────────────────────────────────────────────────────────
export function MoodboardEditor({ stage, version, ctx, editable }: EditorProps) {
  const s = useContentState(stage, version);
  return (
    <div>
      <div className="grid gap-5">
        <Field label="Título">
          <Input value={s.content.title ?? ''} disabled={!editable} onChange={(e) => s.set({ title: e.target.value })} placeholder="Ex.: Delicadeza com presença" />
        </Field>
        <Field label="Descrição">
          <Textarea rows={3} value={s.content.description ?? ''} disabled={!editable} onChange={(e) => s.set({ description: e.target.value })} />
        </Field>
      </div>
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      <div className="mt-8">
        <p className="label mb-3 text-wine">Imagens (arraste para reorganizar)</p>
        <AssetGrid ctx={ctx} stage={stage} version={version} assets={version.assets} editable={editable} captions />
      </div>
    </div>
  );
}

// ─── 06 / 07 / 09 — galerias e arquivos ────────────────────────────────────
export function GalleryEditor({ stage, version, ctx, editable, files }: EditorProps & { files?: boolean }) {
  const s = useContentState(stage, version);
  return (
    <div>
      <Field label="Descrição">
        <Textarea rows={3} value={s.content.description ?? ''} disabled={!editable} onChange={(e) => s.set({ description: e.target.value })} placeholder={files ? 'Ex.: Arquivos finais da sua identidade visual.' : undefined} />
      </Field>
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      <div className="mt-8">
        <p className="label mb-3 text-wine">{files ? 'Arquivos para download' : 'Imagens (arraste para reorganizar)'}</p>
        <AssetGrid ctx={ctx} stage={stage} version={version} assets={version.assets} editable={editable} captions files={files} />
      </div>
    </div>
  );
}

// ─── 08 Aprovação final ────────────────────────────────────────────────────
export function FinalEditor({ stage, version, editable }: EditorProps) {
  const s = useContentState(stage, version);
  return (
    <div>
      <Field label="Mensagem para o cliente" hint="Aparece no topo da aprovação final. O resumo (logo escolhido, cores e fontes) é montado automaticamente.">
        <Textarea rows={4} value={s.content.message ?? ''} disabled={!editable} onChange={(e) => s.set({ message: e.target.value })} placeholder="Chegamos ao fim da construção da sua identidade. ♡" />
      </Field>
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      <p className="mt-6 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Só é possível enviar a aprovação final depois que todas as outras etapas ativas estiverem aprovadas.</p>
    </div>
  );
}

// ─── 04 Cores ──────────────────────────────────────────────────────────────
export function ColorsEditor({ stage, version, editable }: EditorProps) {
  const s = useContentState(stage, version);
  const colors = s.content.colors ?? [];
  const update = (id: string, patch: Partial<ColorItem>) => s.set({ colors: colors.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  return (
    <div>
      <Field label="Descrição da paleta">
        <Textarea rows={3} value={s.content.description ?? ''} disabled={!editable} onChange={(e) => s.set({ description: e.target.value })} />
      </Field>
      <div className="mt-6 space-y-3">
        {colors.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-wine/15 p-3">
            <input type="color" aria-label="Escolher cor" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#771430'} disabled={!editable} onChange={(e) => update(c.id, { hex: e.target.value })} className="size-12 shrink-0 cursor-pointer rounded-xl border border-wine/20 bg-white p-1" />
            <Input className="!w-28 font-mono" value={c.hex} disabled={!editable} onChange={(e) => update(c.id, { hex: e.target.value })} placeholder="#771430" maxLength={7} aria-label="Código HEX" />
            <Input className="min-w-40 flex-1" value={c.name} disabled={!editable} onChange={(e) => update(c.id, { name: e.target.value })} placeholder="Nome da cor (ex.: Vinho)" aria-label="Nome da cor" />
            <Input className="!w-40" value={c.role} disabled={!editable} onChange={(e) => update(c.id, { role: e.target.value })} placeholder="Principal / Apoio…" aria-label="Função da cor" />
            {editable && (
              <button aria-label="Remover cor" onClick={() => s.set({ colors: colors.filter((x) => x.id !== c.id) })} className="rounded-full p-2 text-wine transition hover:bg-blush">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {editable && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => s.set({ colors: [...colors, { id: newId(), name: '', hex: '#771430', role: colors.length ? 'Apoio' : 'Principal' }] })}>
            <Plus className="size-4" /> Adicionar cor
          </Button>
        </div>
      )}
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
    </div>
  );
}

// ─── 05 Tipografia ─────────────────────────────────────────────────────────
export function TypographyEditor({ stage, version, ctx, editable }: EditorProps) {
  const s = useContentState(stage, version);
  const fonts = s.content.fonts ?? [];
  const update = (id: string, patch: Partial<FontItem>) => s.set({ fonts: fonts.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  return (
    <div>
      <Field label="Descrição">
        <Textarea rows={3} value={s.content.description ?? ''} disabled={!editable} onChange={(e) => s.set({ description: e.target.value })} />
      </Field>
      <p className="mb-2 mt-6 text-xs text-ink/55">Dica: use o nome exato de uma fonte do Google Fonts (ex.: Poppins, Playfair Display) para o cliente ver o texto na fonte real.</p>
      <div className="space-y-3">
        {fonts.map((f) => (
          <div key={f.id} className="grid gap-3 rounded-2xl border border-wine/15 p-4 sm:grid-cols-2">
            <Input value={f.name} disabled={!editable} onChange={(e) => update(f.id, { name: e.target.value })} placeholder="Nome da fonte" aria-label="Nome da fonte" />
            <Input value={f.role} disabled={!editable} onChange={(e) => update(f.id, { role: e.target.value })} placeholder="Uso: Títulos, Texto, Destaque…" aria-label="Uso" />
            <Textarea className="sm:col-span-2" rows={2} value={f.sample} disabled={!editable} onChange={(e) => update(f.id, { sample: e.target.value })} placeholder="Texto de exemplo" aria-label="Texto de exemplo" />
            <Input className="sm:col-span-2" value={f.note} disabled={!editable} onChange={(e) => update(f.id, { note: e.target.value })} placeholder="Observação (tamanhos, pesos, onde usar)" aria-label="Observação" />
            {editable && (
              <button onClick={() => s.set({ fonts: fonts.filter((x) => x.id !== f.id) })} className="flex items-center gap-1.5 justify-self-start text-xs text-wine hover:underline">
                <Trash2 className="size-3.5" /> Remover fonte
              </button>
            )}
          </div>
        ))}
      </div>
      {editable && (
        <Button className="mt-4" variant="outline" size="sm" onClick={() => s.set({ fonts: [...fonts, { id: newId(), name: '', role: fonts.length ? 'Texto' : 'Títulos', sample: '', note: '' }] })}>
          <Plus className="size-4" /> Adicionar fonte
        </Button>
      )}
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      <div className="mt-8">
        <p className="label mb-3 text-wine">Imagens de apoio (opcional)</p>
        <AssetGrid ctx={ctx} stage={stage} version={version} assets={version.assets} editable={editable} captions />
      </div>
    </div>
  );
}

// ─── 03 Logo ───────────────────────────────────────────────────────────────
export function LogoEditor({ stage, version, ctx, editable }: EditorProps) {
  const { pending, run } = useRun();
  return (
    <div className="space-y-6">
      {version.proposals.length === 0 && <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Crie a primeira proposta (A) e suba as versões do logo.</p>}
      {version.proposals.map((p) => (
        <ProposalEditor key={p.id} proposal={p} stage={stage} version={version} ctx={ctx} editable={editable} />
      ))}
      {editable && (
        <Button variant="outline" onClick={() => run(() => addLogoProposal(stage.id), 'Proposta criada')} loading={pending}>
          <Plus className="size-4" /> Adicionar proposta
        </Button>
      )}
    </div>
  );
}

function ProposalEditor({ proposal, stage, version, ctx, editable }: { proposal: ProposalData; stage: StageData; version: VersionData; ctx: EditorCtx; editable: boolean }) {
  const [label, setLabel] = useState(proposal.label);
  const [description, setDescription] = useState(proposal.description);
  const { pending, run } = useRun();
  const dirty = label !== proposal.label || description !== proposal.description;
  return (
    <section className="rounded-3xl border border-wine/20 p-5">
      <div className="mb-4 grid gap-3 sm:grid-cols-[14rem_1fr_auto]">
        <Input value={label} disabled={!editable} onChange={(e) => setLabel(e.target.value)} aria-label="Nome da proposta" />
        <Input value={description} disabled={!editable} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" aria-label="Descrição da proposta" />
        {editable && (
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} loading={pending} onClick={() => run(() => updateLogoProposal(proposal.id, label, description), 'Proposta salva')}>
              <Save className="size-3.5" />
            </Button>
            <Button size="sm" variant="danger" aria-label="Remover proposta" onClick={() => confirm(`Remover a ${proposal.label} e seus arquivos?`) && run(() => removeLogoProposal(proposal.id), 'Proposta removida')}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      {(proposal.is_favorite || proposal.is_chosen) && (
        <p className="mb-4 flex flex-wrap gap-2 text-xs">
          {proposal.is_favorite && <span className="rounded-full bg-blush px-3 py-1 text-wine">♡ Favorita do cliente</span>}
          {proposal.is_chosen && <span className="rounded-full bg-wine px-3 py-1 text-white">★ Escolhida pelo cliente</span>}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LOGO_SLOTS.map(([slot, name]) => (
          <SlotUploader key={slot} ctx={ctx} stage={stage} version={version} proposalId={proposal.id} slot={slot} label={name} asset={proposal.assets.find((a) => a.slot === slot)} editable={editable} />
        ))}
      </div>
    </section>
  );
}

// ─── Upload: grade ordenável ───────────────────────────────────────────────
function folderOf(ctx: EditorCtx, stage: StageData) {
  return `${ctx.ownerId}/${ctx.clientId}/identidade/${ctx.projectId}/${stage.stage_key}`;
}

export function AssetGrid({ ctx, stage, version, assets, editable, captions, files }: { ctx: EditorCtx; stage: StageData; version: VersionData; assets: SignedAsset[]; editable: boolean; captions?: boolean; files?: boolean }) {
  const { run, toast, router } = useRun();
  const [busy, setBusy] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = order ? order.map((id) => assets.find((a) => a.id === id)).filter((x): x is SignedAsset => !!x) : assets;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function upload(list: File[]) {
    if (!list.length) return;
    for (const f of list) {
      const err = files ? (f.size > MAX_FILE_MB * 1024 * 1024 ? `"${f.name}" é maior que ${MAX_FILE_MB} MB.` : null) : validateFile(f, 'image');
      if (err) return toast(err, 'error');
    }
    setBusy('up');
    try {
      for (const f of list) {
        const path = await uploadToStorage(f, folderOf(ctx, stage));
        const r = await registerIdentityAsset({ stageId: stage.id, versionId: version.id, path, mime: f.type, fileName: f.name });
        if (!r.ok) throw new Error(r.error);
      }
      toast(list.length > 1 ? `${list.length} arquivos enviados` : 'Arquivo enviado');
      setOrder(null);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha no upload.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = shown.map((a) => a.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrder(next);
    const r = await reorderIdentityAssets(version.id, next);
    if (!r.ok) toast(r.error, 'error');
    router.refresh();
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((a) => a.id)} strategy={rectSortingStrategy}>
          <div className={cn('grid gap-3', files ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
            {shown.map((a) => (
              <SortableAsset key={a.id} asset={a} editable={editable} captions={captions} file={files} onRemove={() => run(() => removeIdentityAsset(a.id))} />
            ))}
            {editable && (
              <button type="button" onClick={() => inputRef.current?.click()} className={cn('flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-wine/30 p-4 text-center text-xs text-wine transition hover:border-wine hover:bg-blush', files ? 'py-6' : 'aspect-[4/5] flex-col')}>
                {busy ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
                {files ? 'Adicionar arquivos' : 'Adicionar imagens'}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <input ref={inputRef} type="file" hidden multiple accept={files ? undefined : 'image/*'} onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </div>
  );
}

function SortableAsset({ asset, editable, captions, file, onRemove }: { asset: SignedAsset; editable: boolean; captions?: boolean; file?: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id, disabled: !editable });
  const [caption, setCaption] = useState(asset.caption);
  const toast = useToast();
  const saveCaption = async () => {
    if (caption === asset.caption) return;
    const r = await updateIdentityAssetCaption(asset.id, caption);
    if (!r.ok) toast(r.error, 'error');
  };
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('rounded-2xl border border-wine/20 bg-white', isDragging && 'z-10 opacity-60 ring-2 ring-wine')}>
      <div className={cn('relative overflow-hidden rounded-t-2xl bg-blush', file ? 'flex items-center gap-3 rounded-2xl bg-white p-3' : 'aspect-[4/5]')}>
        {file ? (
          <>
            <FileText className="size-5 shrink-0 text-wine" />
            <span className="min-w-0 flex-1 truncate text-sm">{asset.file_name || 'Arquivo'}</span>
          </>
        ) : (
          <img src={asset.url} alt={asset.caption} className="size-full object-cover" draggable={false} />
        )}
        {editable && (
          <>
            <button {...attributes} {...listeners} aria-label="Arrastar" className={cn('cursor-grab touch-none rounded-full bg-white/90 p-1 text-wine active:cursor-grabbing', file ? 'order-first' : 'absolute left-1.5 top-1.5')}>
              <GripVertical className="size-4" />
            </button>
            <button onClick={onRemove} aria-label="Remover" className={cn('rounded-full bg-white/90 p-1 text-wine transition hover:bg-wine hover:text-white', file ? '' : 'absolute right-1.5 top-1.5')}>
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
      {captions && (
        <Input className="!rounded-t-none !border-0 !border-t !px-3 !py-2 !text-xs" value={caption} disabled={!editable} onChange={(e) => setCaption(e.target.value)} onBlur={saveCaption} placeholder={file ? 'Nome exibido (ex.: Logo em PNG)' : 'Legenda (opcional)'} aria-label="Legenda" />
      )}
    </div>
  );
}

// ─── Upload: uma variação do logo ──────────────────────────────────────────
function SlotUploader({ ctx, stage, version, proposalId, slot, label, asset, editable }: { ctx: EditorCtx; stage: StageData; version: VersionData; proposalId: string; slot: string; label: string; asset?: SignedAsset; editable: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const { run, toast, router } = useRun();
  const [busy, setBusy] = useState(false);
  const dark = slot === 'light';

  async function upload(f?: File) {
    if (!f) return;
    const err = validateFile(f, 'image');
    if (err) return toast(err, 'error');
    setBusy(true);
    try {
      const path = await uploadToStorage(f, folderOf(ctx, stage));
      const r = await registerIdentityAsset({ stageId: stage.id, versionId: version.id, proposalId, slot, path, mime: f.type, fileName: f.name, replaceSlot: true });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha no upload.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={cn('relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-wine/20', dark ? 'bg-ink' : 'bg-white', !asset && 'border-dashed')}>
        {asset ? (
          <img src={asset.url} alt={label} className="max-h-full max-w-full object-contain p-3" />
        ) : (
          <button type="button" disabled={!editable} onClick={() => ref.current?.click()} className="flex size-full flex-col items-center justify-center gap-1.5 text-wine/70 transition hover:bg-blush disabled:hover:bg-transparent">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            <span className="text-[0.7rem]">Enviar</span>
          </button>
        )}
        {asset && editable && (
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button onClick={() => ref.current?.click()} className="rounded-full bg-white/90 px-2.5 py-0.5 text-[0.68rem] text-wine hover:bg-wine hover:text-white">{busy ? '…' : 'Trocar'}</button>
            <button onClick={() => run(() => removeIdentityAsset(asset.id))} aria-label={`Remover ${label}`} className="rounded-full bg-white/90 p-1 text-wine hover:bg-wine hover:text-white">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="label mt-1.5 text-center text-ink/55">{label}</p>
    </div>
  );
}
