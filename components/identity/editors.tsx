'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Download, FileText, GitCompareArrows, GripVertical, History, ImagePlus, Loader2, Plus, RotateCcw, Save, Trash2, Type, UploadCloud } from 'lucide-react';
import {
  addLogoProposal,
  createLogoVersion,
  registerIdentityAsset,
  removeIdentityAsset,
  removeLogoProposal,
  reorderIdentityAssets,
  restoreLogoVersion,
  saveStageContent,
  setAssetReleased,
  updateIdentityAsset,
  updateLogoProposal,
  updateLogoVersion,
} from '@/lib/actions/identity';
import { cmykText, getFonts, getPalettes, hexToRgb, isHex } from '@/lib/identity/color';
import {
  APPLICATION_CATEGORIES,
  CONCEPT_FIELDS,
  ELEMENT_CATEGORIES,
  FILE_CATEGORIES,
  FONT_CATEGORIES,
  FONT_ROLES,
  LOGO_SLOTS,
  STAGE_FOLDER,
  latestLogoVersion,
  newId,
  type ColorItem,
  type FontItem,
  type IdentityFavorite,
  type Palette,
  type ProposalData,
  type SignedAsset,
  type StageContent,
  type StageData,
  type VersionData,
} from '@/lib/identity/types';
import { uploadToStorage, validateFile } from '@/lib/upload';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtFullDate } from '@/lib/utils';
import { VersionCompare } from './views/VersionCompare';

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
  favorites?: IdentityFavorite[];
  downloads?: Record<string, number>;
}

const MAX_FILE_MB = 50;
const pad = (n: number) => String(n).padStart(2, '0');
const today = () => new Date().toISOString().slice(0, 10);

/** Salvar / enviar com toast + atualização da página. */
function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
      if (okMsg) toast(okMsg);
      after?.();
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
  const save = () => run(() => saveStageContent(stage.id, content), 'Alterações salvas ♡', () => setDirty(false));
  return { content, set, dirty, save, saving: pending };
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

const folderOf = (ctx: EditorCtx, stage: StageData) => `${ctx.ownerId}/${ctx.clientId}/brands/${ctx.projectId}/${STAGE_FOLDER[stage.stage_key]}`;

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
        <p className="label mb-3 text-wine">Imagens (arraste pelo ícone ⠿ para reorganizar)</p>
        <AssetGrid ctx={ctx} stage={stage} version={version} assets={version.assets} editable={editable} captions />
      </div>
    </div>
  );
}

// ─── 06 Elementos / 07 Aplicações / 09 Arquivos ────────────────────────────
export function GalleryEditor({ stage, version, ctx, editable, downloads, mode }: EditorProps & { mode: 'elements' | 'applications' | 'files' }) {
  const s = useContentState(stage, version);
  const categories: [string, string][] =
    mode === 'files' ? FILE_CATEGORIES : (mode === 'elements' ? ELEMENT_CATEGORIES : APPLICATION_CATEGORIES).map((c) => [c, c]);
  return (
    <div>
      <Field label="Descrição">
        <Textarea rows={3} value={s.content.description ?? ''} disabled={!editable} onChange={(e) => s.set({ description: e.target.value })} placeholder={mode === 'files' ? 'Ex.: Os arquivos finais da sua marca.' : undefined} />
      </Field>
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      {mode === 'files' && <p className="mt-6 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Os arquivos só aparecem para o cliente depois que o projeto for <strong className="font-normal">aprovado</strong> e se estiverem com <strong className="font-normal">“Disponibilizar para cliente”</strong> ligado. Arquivos de trabalho ficam bloqueados por padrão.</p>}
      <div className="mt-8">
        <p className="label mb-3 text-wine">{mode === 'files' ? 'Arquivos' : mode === 'elements' ? 'Elementos visuais' : 'Mockups e aplicações'}</p>
        <AssetGrid ctx={ctx} stage={stage} version={version} assets={version.assets} editable={editable} files={mode === 'files'} meta={{ name: true, description: mode !== 'files', categories }} release={mode === 'files'} downloads={downloads} />
      </div>
    </div>
  );
}

// ─── 08 Aprovação final ────────────────────────────────────────────────────
export function FinalEditor({ stage, version, editable }: EditorProps) {
  const s = useContentState(stage, version);
  return (
    <div>
      <Field label="Mensagem para o cliente" hint="Aparece no topo da aprovação final. O resumo (logo escolhido, paleta, fontes, elementos e aplicações) é montado automaticamente.">
        <Textarea rows={4} value={s.content.message ?? ''} disabled={!editable} onChange={(e) => s.set({ message: e.target.value })} placeholder="Chegamos ao fim da construção da sua identidade. ♡" />
      </Field>
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      <p className="mt-6 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">A aprovação final é liberada <strong className="font-normal">automaticamente</strong> para o cliente quando todas as outras etapas ativas estiverem aprovadas.</p>
    </div>
  );
}

// ─── 04 Cores ──────────────────────────────────────────────────────────────
export function ColorsEditor({ stage, version, editable }: EditorProps) {
  const s = useContentState(stage, version);
  const palettes = getPalettes(s.content);
  const setPalettes = (p: Palette[]) => s.set({ palettes: p, colors: undefined });
  const upPalette = (id: string, patch: Partial<Palette>) => setPalettes(palettes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const upColor = (pid: string, cid: string, patch: Partial<ColorItem>) => setPalettes(palettes.map((p) => (p.id === pid ? { ...p, colors: p.colors.map((c) => (c.id === cid ? { ...c, ...patch } : c)) } : p)));

  return (
    <div>
      <Field label="Descrição geral das cores">
        <Textarea rows={3} value={s.content.description ?? ''} disabled={!editable} onChange={(e) => s.set({ description: e.target.value })} />
      </Field>

      <div className="mt-6 space-y-6">
        {palettes.map((p) => (
          <section key={p.id} className="rounded-3xl border border-wine/20 p-4 sm:p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-[14rem_1fr_auto]">
              <Input value={p.label} disabled={!editable} onChange={(e) => upPalette(p.id, { label: e.target.value })} aria-label="Nome da paleta" />
              <Input value={p.description} disabled={!editable} onChange={(e) => upPalette(p.id, { description: e.target.value })} placeholder="Descrição (opcional)" aria-label="Descrição da paleta" />
              {editable && (
                <Button size="sm" variant="danger" aria-label="Remover paleta" onClick={() => confirm(`Remover ${p.label}?`) && setPalettes(palettes.filter((x) => x.id !== p.id))}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="mb-4 flex h-10 overflow-hidden rounded-xl border border-wine/15">
              {p.colors.map((c) => (
                <span key={c.id} className="flex-1" style={{ backgroundColor: isHex(c.hex) ? c.hex : '#ffffff' }} />
              ))}
            </div>
            <div className="space-y-2.5">
              {p.colors.map((c) => (
                <div key={c.id} className="grid gap-2 rounded-2xl border border-wine/15 p-3 sm:grid-cols-[auto_8rem_1fr_1fr_8rem_auto] sm:items-center">
                  {/* Color Picker visual ⇄ HEX (um atualiza o outro) */}
                  <input type="color" aria-label="Escolher cor" value={isHex(c.hex) ? c.hex : '#771430'} disabled={!editable} onChange={(e) => upColor(p.id, c.id, { hex: e.target.value })} className="size-11 cursor-pointer rounded-xl border border-wine/20 bg-white p-1" />
                  <Input className="font-mono" value={c.hex} disabled={!editable} maxLength={7} onChange={(e) => upColor(p.id, c.id, { hex: e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}` })} placeholder="#771430" aria-label="Código HEX" />
                  <Input value={c.name} disabled={!editable} onChange={(e) => upColor(p.id, c.id, { name: e.target.value })} placeholder="Nome (ex.: Areia)" aria-label="Nome da cor" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={c.cmyk} disabled={!editable} onChange={(e) => upColor(p.id, c.id, { cmyk: e.target.value })} placeholder={isHex(c.hex) ? cmykText({ hex: c.hex, cmyk: '' }) : 'CMYK'} aria-label="CMYK (automático; edite se quiser)" />
                    <Input value={c.pantone} disabled={!editable} onChange={(e) => upColor(p.id, c.id, { pantone: e.target.value })} placeholder="Pantone (opc.)" aria-label="Pantone" />
                  </div>
                  <p className="font-mono text-[0.7rem] leading-tight text-ink/55">RGB {isHex(c.hex) ? hexToRgb(c.hex).join(' ') : '—'}</p>
                  {editable && (
                    <button aria-label="Remover cor" onClick={() => upPalette(p.id, { colors: p.colors.filter((x) => x.id !== c.id) })} className="rounded-full p-2 text-wine transition hover:bg-blush">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editable && (
              <Button className="mt-3" variant="outline" size="sm" onClick={() => upPalette(p.id, { colors: [...p.colors, { id: newId(), name: '', hex: '#771430', cmyk: '', pantone: '' }] })}>
                <Plus className="size-4" /> Adicionar cor
              </Button>
            )}
          </section>
        ))}
      </div>

      {editable && (
        <Button className="mt-5" variant="outline" onClick={() => setPalettes([...palettes, { id: newId(), label: `Paleta ${pad(palettes.length + 1)}`, description: '', colors: [] }])}>
          <Plus className="size-4" /> Adicionar paleta
        </Button>
      )}
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
    </div>
  );
}

// ─── 05 Tipografia ─────────────────────────────────────────────────────────
export function TypographyEditor({ stage, version, ctx, editable }: EditorProps) {
  const s = useContentState(stage, version);
  const { run, toast, router } = useRun();
  const fonts = getFonts(s.content);
  const [busy, setBusy] = useState<string | null>(null);
  const fileFor = (fid: string) => version.assets.find((a) => a.slot === 'font' && a.name === fid);
  const update = (id: string, patch: Partial<FontItem>) => s.set({ fonts: fonts.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  async function uploadFont(f: FontItem, file?: File) {
    if (!file) return;
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) return toast('Envie um arquivo de fonte (.ttf, .otf, .woff ou .woff2).', 'error');
    if (file.size > 10 * 1024 * 1024) return toast('A fonte deve ter até 10 MB.', 'error');
    setBusy(f.id);
    try {
      const old = fileFor(f.id);
      if (old) await removeIdentityAsset(old.id);
      const path = await uploadToStorage(file, folderOf(ctx, stage));
      const r = await registerIdentityAsset({ stageId: stage.id, versionId: version.id, slot: 'font', name: f.id, path, mime: file.type || 'font/ttf', fileName: file.name });
      if (!r.ok) throw new Error(r.error);
      toast('Arquivo da fonte enviado');
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha no upload.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <Field label="Descrição">
        <Textarea rows={3} value={s.content.description ?? ''} disabled={!editable} onChange={(e) => s.set({ description: e.target.value })} />
      </Field>
      <p className="mb-2 mt-6 text-xs text-ink/55">Dica: use o nome exato de uma fonte do Google Fonts (ex.: DM Serif Display) para o cliente ver o texto na fonte real. Para fontes licenciadas, envie o arquivo (.ttf, .otf, .woff).</p>
      <div className="space-y-3">
        {fonts.map((f) => {
          const file = fileFor(f.id);
          return (
            <div key={f.id} className="grid gap-3 rounded-2xl border border-wine/15 p-4 sm:grid-cols-2">
              <Select value={f.role} disabled={!editable} onChange={(e) => update(f.id, { role: e.target.value as FontItem['role'] })} aria-label="Papel da fonte">
                {FONT_ROLES.map(([r, l]) => (
                  <option key={r} value={r}>{l}</option>
                ))}
              </Select>
              <Input value={f.name} disabled={!editable} onChange={(e) => update(f.id, { name: e.target.value })} placeholder="Nome da fonte" aria-label="Nome da fonte" />
              <Select value={f.category} disabled={!editable} onChange={(e) => update(f.id, { category: e.target.value })} aria-label="Categoria">
                <option value="">Categoria…</option>
                {FONT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input value={f.reference} disabled={!editable} onChange={(e) => update(f.id, { reference: e.target.value })} placeholder="Link de referência (https://…)" aria-label="Referência" />
              <Input className="sm:col-span-2" value={f.usage} disabled={!editable} onChange={(e) => update(f.id, { usage: e.target.value })} placeholder="Uso recomendado (ex.: títulos, 48–72 pt)" aria-label="Uso recomendado" />
              <Textarea className="sm:col-span-2" rows={2} value={f.sample} disabled={!editable} onChange={(e) => update(f.id, { sample: e.target.value })} placeholder="Texto de exemplo (opcional)" aria-label="Texto de exemplo" />
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                {editable && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-wine/30 px-4 py-1.5 text-xs text-wine transition hover:bg-blush">
                    {busy === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Type className="size-3.5" />}
                    {file ? 'Trocar arquivo da fonte' : 'Enviar arquivo da fonte'}
                    <input type="file" hidden accept=".ttf,.otf,.woff,.woff2" onChange={(e) => { uploadFont(f, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                )}
                {file && <span className="text-xs text-ink/60">{file.file_name}</span>}
                {editable && (
                  <button
                    onClick={() => {
                      if (file) run(() => removeIdentityAsset(file.id));
                      s.set({ fonts: fonts.filter((x) => x.id !== f.id) });
                    }}
                    className="ml-auto flex items-center gap-1.5 text-xs text-wine hover:underline"
                  >
                    <Trash2 className="size-3.5" /> Remover fonte
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editable && (
        <Button className="mt-4" variant="outline" size="sm" onClick={() => s.set({ fonts: [...fonts, { id: newId(), role: fonts.length === 0 ? 'main' : fonts.length === 1 ? 'secondary' : 'support', name: '', category: '', reference: '', usage: '', sample: '' }] })}>
          <Plus className="size-4" /> Adicionar fonte
        </Button>
      )}
      {editable && <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} />}
      <div className="mt-8">
        <p className="label mb-3 text-wine">Imagens de apoio (opcional)</p>
        <AssetGrid ctx={ctx} stage={stage} version={version} assets={version.assets.filter((a) => a.slot !== 'font')} editable={editable} captions />
      </div>
    </div>
  );
}

// ─── 03 Logo ───────────────────────────────────────────────────────────────
export function LogoEditor({ stage, version, ctx, editable, favorites = [] }: EditorProps) {
  const { pending, run } = useRun();
  return (
    <div className="space-y-6">
      {stage.proposals.length === 0 && <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Crie a primeira proposta (A) e suba as versões do logo. Cada proposta tem seu próprio histórico de versões (V1, V2, V3…).</p>}
      {stage.proposals.map((p) => (
        <ProposalEditor key={`${p.id}-${latestLogoVersion(p)?.id}`} proposal={p} stage={stage} version={version} ctx={ctx} editable={editable} fav={favorites.some((f) => f.kind === 'logo' && f.ref_id === p.id)} />
      ))}
      {editable && (
        <Button variant="outline" onClick={() => run(() => addLogoProposal(stage.id), 'Proposta criada')} loading={pending}>
          <Plus className="size-4" /> Adicionar proposta
        </Button>
      )}
    </div>
  );
}

function ProposalEditor({ proposal, stage, version, ctx, editable, fav }: { proposal: ProposalData; stage: StageData; version: VersionData; ctx: EditorCtx; editable: boolean; fav: boolean }) {
  const latest = latestLogoVersion(proposal);
  const [selId, setSelId] = useState(latest?.id);
  const [label, setLabel] = useState(proposal.label);
  const [description, setDescription] = useState(proposal.description);
  const [modal, setModal] = useState<'new' | 'restore' | null>(null);
  const [compare, setCompare] = useState(false);
  const [form, setForm] = useState({ changes: '', internal: '', date: today() });
  const { pending, run } = useRun();

  const sel = proposal.versions.find((v) => v.id === selId) ?? latest;
  const isLatest = sel?.id === latest?.id;
  const [meta, setMeta] = useState({ changes: sel?.changes ?? '', internal: sel?.internal_notes ?? '' });
  if (!sel) return <p className="text-sm text-ink/60">Proposta sem versões. Recarregue a página.</p>;
  const dirty = label !== proposal.label || description !== proposal.description;
  const metaDirty = isLatest && (meta.changes !== sel.changes || meta.internal !== sel.internal_notes);
  const pickVersion = (id: string) => {
    const v = proposal.versions.find((x) => x.id === id);
    setSelId(id);
    setMeta({ changes: v?.changes ?? '', internal: v?.internal_notes ?? '' });
  };

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
            <Button size="sm" variant="danger" aria-label="Remover proposta" onClick={() => confirm(`Remover a ${proposal.label}, todas as versões e arquivos?`) && run(() => removeLogoProposal(proposal.id), 'Proposta removida')}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {(fav || proposal.is_chosen) && (
        <p className="mb-4 flex flex-wrap gap-2 text-xs">
          {fav && <span className="rounded-full bg-blush px-3 py-1 text-wine">♡ Favorita do cliente</span>}
          {proposal.is_chosen && <span className="rounded-full bg-wine px-3 py-1 text-white">★ Escolhida pelo cliente</span>}
        </p>
      )}

      {/* versões: V1 - 28/09/2026 … V3 [VERSÃO ATUAL] */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {proposal.versions.map((v) => (
          <button key={v.id} onClick={() => pickVersion(v.id)} aria-pressed={sel.id === v.id} className={cn('rounded-full border px-3 py-1 text-xs transition', sel.id === v.id ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>
            V{v.version_number} - {fmtFullDate(v.created_at)} {v.id === latest.id && '[VERSÃO ATUAL]'}
          </button>
        ))}
        {editable && (
          <Button size="sm" variant="outline" onClick={() => { setForm({ changes: '', internal: '', date: today() }); setModal('new'); }}>
            <Plus className="size-3.5" /> Nova versão
          </Button>
        )}
        {proposal.versions.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => setCompare(true)}>
            <GitCompareArrows className="size-3.5" /> Comparar versões
          </Button>
        )}
      </div>

      {!isLatest && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-wine/40 px-4 py-3 text-sm text-wine">
          <History className="size-4" /> Você está vendo a V{sel.version_number} (anterior), somente leitura.
          {editable && (
            <Button size="sm" variant="outline" onClick={() => setModal('restore')}>
              <RotateCcw className="size-3.5" /> Usar esta versão novamente
            </Button>
          )}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label={`V${sel.version_number} · Descrição das alterações (cliente vê)`}>
          <Textarea rows={3} value={isLatest ? meta.changes : sel.changes} disabled={!editable || !isLatest} onChange={(e) => setMeta((m) => ({ ...m, changes: e.target.value }))} placeholder={'- aumentamos o respiro;\n- ajustamos o símbolo.'} />
        </Field>
        <Field label="Observações internas (só você vê)">
          <Textarea rows={3} value={isLatest ? meta.internal : sel.internal_notes} disabled={!editable || !isLatest} onChange={(e) => setMeta((m) => ({ ...m, internal: e.target.value }))} />
        </Field>
        {editable && isLatest && (
          <div className="sm:col-span-2">
            <Button size="sm" disabled={!metaDirty} loading={pending} onClick={() => run(() => updateLogoVersion(sel.id, meta.changes, meta.internal), 'Versão salva')}>
              <Save className="size-3.5" /> Salvar descrição da versão
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LOGO_SLOTS.map(([slot, name]) => (
          <SlotUploader key={`${sel.id}-${slot}`} ctx={ctx} stage={stage} version={version} proposalId={proposal.id} logoVersionId={sel.id} slot={slot} label={name} asset={sel.assets.find((a) => a.slot === slot)} editable={editable && isLatest} />
        ))}
      </div>

      <Modal open={modal === 'new'} onClose={() => setModal(null)} title={`Nova versão da ${proposal.label}`}>
        <p className="mb-4 text-sm text-ink/70">A V{latest.version_number + 1} começa como cópia da V{latest.version_number}. Substitua só os arquivos que mudaram. As versões anteriores ficam guardadas, e a etapa volta para “Em criação” até você reenviar.</p>
        <div className="space-y-3">
          <Field label="Descrição das alterações"><Textarea rows={3} value={form.changes} onChange={(e) => setForm({ ...form, changes: e.target.value })} placeholder={'- aumentamos o respiro;\n- ajustamos o símbolo;\n- alteramos o peso da tipografia.'} /></Field>
          <Field label="Data"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Observações internas"><Textarea rows={2} value={form.internal} onChange={(e) => setForm({ ...form, internal: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button loading={pending} onClick={() => run(() => createLogoVersion(proposal.id, { changes: form.changes, internalNotes: form.internal, date: form.date }), `V${latest.version_number + 1} criada`, () => setModal(null))}>
            Criar V{latest.version_number + 1}
          </Button>
        </div>
      </Modal>

      <Modal open={modal === 'restore'} onClose={() => setModal(null)} title="Usar esta versão novamente?">
        <p className="mb-6 text-sm text-ink/70">Vamos criar a <strong className="font-normal text-wine">V{latest.version_number + 1}</strong> com os arquivos da V{sel.version_number}. Nenhuma versão é apagada.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button loading={pending} onClick={() => run(() => restoreLogoVersion(proposal.id, sel.id), `V${sel.version_number} usada como V${latest.version_number + 1}`, () => setModal(null))}>
            Criar V{latest.version_number + 1}
          </Button>
        </div>
      </Modal>

      {compare && <VersionCompare proposal={proposal} open onClose={() => setCompare(false)} initialA={(proposal.versions[proposal.versions.length - 2] ?? latest).id} initialB={latest.id} />}
    </section>
  );
}

// ─── Upload: grade ordenável ───────────────────────────────────────────────
interface GridMeta {
  name?: boolean;
  description?: boolean;
  categories?: [string, string][];
}

export function AssetGrid({ ctx, stage, version, assets, editable, captions, files, meta, release, downloads }: { ctx: EditorCtx; stage: StageData; version: VersionData; assets: SignedAsset[]; editable: boolean; captions?: boolean; files?: boolean; meta?: GridMeta; release?: boolean; downloads?: Record<string, number> }) {
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
        const r = await registerIdentityAsset({ stageId: stage.id, versionId: version.id, path, mime: f.type, fileName: f.name, name: meta?.name ? f.name.replace(/\.[^.]+$/, '') : undefined });
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
              <SortableAsset key={a.id} asset={a} editable={editable} captions={captions} file={files} meta={meta} release={release} downloads={downloads?.[a.id]} onRemove={() => run(() => removeIdentityAsset(a.id))} />
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

function SortableAsset({ asset, editable, captions, file, meta, release, downloads, onRemove }: { asset: SignedAsset; editable: boolean; captions?: boolean; file?: boolean; meta?: GridMeta; release?: boolean; downloads?: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id, disabled: !editable });
  const [f, setF] = useState({ name: asset.name, description: asset.description, caption: asset.caption, category: asset.category });
  const { run, toast } = useRun();
  const save = async (patch: Partial<typeof f>) => {
    const r = await updateIdentityAsset(asset.id, patch);
    if (!r.ok) toast(r.error, 'error');
  };
  const blur = (k: keyof typeof f) => () => f[k] !== asset[k] && save({ [k]: f[k] });
  const small = '!rounded-none !border-0 !border-t !px-3 !py-2 !text-xs';

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('overflow-hidden rounded-2xl border border-wine/20 bg-white', isDragging && 'z-10 opacity-60 ring-2 ring-wine')}>
      <div className={cn('relative bg-blush', file ? 'flex items-center gap-3 bg-white p-3' : 'aspect-[4/5]')}>
        {file ? (
          <>
            <FileText className="size-5 shrink-0 text-wine" />
            <span className="min-w-0 flex-1 truncate text-sm">{asset.file_name || 'Arquivo'}</span>
            {downloads ? <span className="inline-flex items-center gap-1 text-xs text-ink/55"><Download className="size-3" /> {downloads}</span> : null}
          </>
        ) : (
          <img src={asset.url} alt={asset.name || asset.caption} className="size-full object-cover" draggable={false} />
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
      {meta?.name && <Input className={small} value={f.name} disabled={!editable} onChange={(e) => setF({ ...f, name: e.target.value })} onBlur={blur('name')} placeholder="Nome" aria-label="Nome" />}
      {meta?.categories && (
        <Select className={small} value={f.category} disabled={!editable} onChange={(e) => { setF({ ...f, category: e.target.value }); save({ category: e.target.value }); }} aria-label="Categoria">
          <option value="">Categoria…</option>
          {meta.categories.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </Select>
      )}
      {meta?.description && <Textarea rows={2} className={cn(small, 'min-h-0')} value={f.description} disabled={!editable} onChange={(e) => setF({ ...f, description: e.target.value })} onBlur={blur('description')} placeholder="Descrição" aria-label="Descrição" />}
      {captions && !meta && <Input className={small} value={f.caption} disabled={!editable} onChange={(e) => setF({ ...f, caption: e.target.value })} onBlur={blur('caption')} placeholder="Legenda (opcional)" aria-label="Legenda" />}
      {release && (
        <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-wine/15 px-3 py-2 text-xs">
          <span className={asset.released ? 'text-wine' : 'text-ink/55'}>Disponibilizar para cliente</span>
          <button role="switch" aria-checked={asset.released} disabled={!editable} onClick={() => run(() => setAssetReleased(asset.id, !asset.released), asset.released ? 'Arquivo bloqueado' : 'Arquivo liberado ♡')} className={cn('relative h-5 w-9 shrink-0 rounded-full border transition', asset.released ? 'border-wine bg-wine' : 'border-wine/30 bg-white')}>
            <span className={cn('absolute top-0.5 size-3.5 rounded-full transition-all', asset.released ? 'left-[1.15rem] bg-white' : 'left-0.5 bg-wine/40')} />
          </button>
        </label>
      )}
    </div>
  );
}

// ─── Upload: uma variação do logo ──────────────────────────────────────────
function SlotUploader({ ctx, stage, version, proposalId, logoVersionId, slot, label, asset, editable }: { ctx: EditorCtx; stage: StageData; version: VersionData; proposalId: string; logoVersionId: string; slot: string; label: string; asset?: SignedAsset; editable: boolean }) {
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
      const r = await registerIdentityAsset({ stageId: stage.id, versionId: version.id, proposalId, logoVersionId, slot, path, mime: f.type, fileName: f.name, replaceSlot: true });
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
            <span className="text-[0.7rem]">{editable ? 'Enviar' : '—'}</span>
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
