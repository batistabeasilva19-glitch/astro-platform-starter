'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Copy, ExternalLink, FileText, Link2, Loader2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import { addAttachmentLink, addChecklist, addChecklistItem, addComment, addSubtask, createTag, deleteAttachment, deleteChecklist, deleteChecklistItem, deleteComment, deleteSubtask, deleteTask, duplicateTask, archiveTask, getRelationOptions, getTaskDetail, moveTask, registerAttachmentFile, renameChecklist, setAssignees, setTaskTags, updateChecklistItem, updateSubtask, updateTask } from '@/lib/actions/production';
import type { TaskDetail } from '@/lib/data/production';
import { uploadToStorage } from '@/lib/upload';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';
import { monthLabel } from '@/lib/perf/calc';
import { CATEGORIES, CHECKLIST_TEMPLATES, LINK_TYPES, PRIORITIES, TAG_COLORS, guessLinkType, type ClientLite, type ColumnRow, type MemberRow, type TagRow } from '@/lib/production/types';
import { MemberAvatar } from './shared';

interface Props {
  taskId: string;
  ownerId: string;
  columnsByBoard: Record<string, ColumnRow[]>;
  members: MemberRow[];
  tags: TagRow[];
  clients: ClientLite[];
  onClose: () => void;
}

/** Campo de texto que guarda ao sair (sem perder o foco a cada letra). */
function TextField({ label, value, onSave, multiline, rows = 4, placeholder, type = 'text' }: { label: string; value: string; onSave: (v: string) => void; multiline?: boolean; rows?: number; placeholder?: string; type?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => v !== value && onSave(v);
  return (
    <Field label={label}>
      {multiline ? <Textarea rows={rows} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} /> : <Input type={type} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && type === 'text' && (e.currentTarget as HTMLInputElement).blur()} />}
    </Field>
  );
}

const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-[0.78rem] transition', on ? 'border-wine bg-wine text-white' : 'border-wine/30 bg-white text-wine hover:bg-blush');
const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="rounded-3xl border border-wine/12 bg-white p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="label text-wine">{title}</h3>{action}</div>
    {children}
  </section>
);

export function TaskModal({ taskId, ownerId, columnsByBoard, members, tags: initialTags, clients, onClose }: Props) {
  const [d, setD] = useState<TaskDetail | null>(null);
  const [tags, setTags] = useState(initialTags);
  const [busy, setBusy] = useState(false);
  const [rel, setRel] = useState<{ contents: { id: string; title: string; format: string; date: string | null }[]; identities: { id: string; name: string }[]; reports: { id: string; month: string }[]; campaigns: { id: string; name: string }[] } | null>(null);
  const [dup, setDup] = useState(false);
  const [dupOpts, setDupOpts] = useState({ keepClient: false, keepDue: false, keepAssignees: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  const reload = useCallback(async () => {
    const r = await getTaskDetail(taskId);
    if (r.ok) setD(r.detail);
    else toast(r.error, 'error');
  }, [taskId, toast]);
  useEffect(() => {
    reload();
  }, [reload]);

  const clientId = d?.task.client_id ?? null;
  useEffect(() => {
    let live = true;
    setRel(null);
    if (clientId) getRelationOptions(clientId).then((r) => live && r.ok && setRel(r));
    return () => {
      live = false;
    };
  }, [clientId]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
    if (msg) toast(msg);
    await reload();
    router.refresh();
  };
  const patch = (p: Parameters<typeof updateTask>[1], msg?: string) => act(() => updateTask(taskId, p), msg);

  async function upload(files: File[]) {
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) return toast(`“${f.name}” tem mais de 50 MB.`, 'error');
    }
    setBusy(true);
    try {
      for (const f of files) {
        const path = await uploadToStorage(f, `${ownerId}/producao/${taskId}`);
        const r = await registerAttachmentFile(taskId, { path, name: f.name, mime: f.type, size: f.size });
        if (!r.ok) throw new Error(r.error);
      }
      toast('Anexo adicionado ♡');
      await reload();
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha no envio.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const title = d?.task.title ?? 'Carregando…';
  const cols = d ? (columnsByBoard[d.task.board_id] ?? []) : [];

  return (
    <Modal open onClose={onClose} title={<span className="line-clamp-1">{title}</span>} className="sm:!max-w-4xl">
      {!d ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink/55"><Loader2 className="size-4 animate-spin" /> Abrindo…</div>
      ) : (
        <div className={cn('space-y-4', busy && 'pointer-events-none opacity-70')}>
          <Section title="Tarefa">
            <div className="space-y-4">
              <TextField label="Título" value={d.task.title} onSave={(v) => patch({ title: v })} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Status (coluna)">
                  <Select value={d.task.column_id} onChange={(e) => act(() => moveTask(taskId, e.target.value, Date.now()), 'Movido ♡')}>
                    {cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Prioridade">
                  <Select value={d.task.priority} onChange={(e) => patch({ priority: e.target.value })}>
                    {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </Select>
                </Field>
                <Field label="Categoria">
                  <Select value={d.task.category} onChange={(e) => patch({ category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cliente">
                  <Select value={d.task.client_id ?? ''} onChange={(e) => patch({ client_id: e.target.value || null, content_id: null, identity_project_id: null, report_id: null, campaign_id: null })}>
                    <option value="">Sem cliente</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  {d.links.client && <Link href={`/admin/clients/${d.links.client.id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs text-wine underline-offset-4 hover:underline">Abrir página de {d.links.client.name} <ExternalLink className="size-3" /></Link>}
                </Field>
                <TextField label="Projeto" value={d.task.project_name} onSave={(v) => patch({ project_name: v })} placeholder="Ex.: Campanha de outubro" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Data de início" type="date" value={d.task.start_date ?? ''} onSave={(v) => patch({ start_date: v || null })} />
                <TextField label="Prazo" type="date" value={d.task.due_date ?? ''} onSave={(v) => patch({ due_date: v || null })} />
                <TextField label="Horário (opcional)" type="time" value={d.task.due_time?.slice(0, 5) ?? ''} onSave={(v) => patch({ due_time: v || null })} />
              </div>
              <div>
                <p className="label mb-2 text-wine">Responsáveis</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const on = d.assignee_ids.includes(m.id);
                    return (
                      <button key={m.id} type="button" aria-pressed={on} onClick={() => act(() => setAssignees(taskId, on ? d.assignee_ids.filter((x) => x !== m.id) : [...d.assignee_ids, m.id]))} className={cn(chip(on), 'inline-flex items-center gap-2')}>
                        <MemberAvatar member={m} className="size-5 ring-0" /> {m.name}{m.role ? <span className="opacity-70"> · {m.role}</span> : null}
                      </button>
                    );
                  })}
                  {members.length === 0 && <span className="text-sm text-ink/50">Nenhum membro cadastrado.</span>}
                </div>
              </div>
              <TagPicker tags={tags} selected={d.tag_ids} onChange={(ids) => act(() => setTaskTags(taskId, ids))} onCreated={(t) => setTags((s) => [...s, t])} />
            </div>
          </Section>

          <Section title="Vínculos com o que já existe" action={d.task.client_id ? undefined : <span className="text-xs text-ink/45">Escolha um cliente para vincular</span>}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Conteúdo">
                <Select disabled={!clientId || !rel} value={d.task.content_id ?? ''} onChange={(e) => patch({ content_id: e.target.value || null })}>
                  <option value="">Nenhum</option>
                  {(rel?.contents ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}{c.date ? ` · ${c.date.split('-').reverse().join('/')}` : ''}</option>)}
                </Select>
                {d.links.content && <Link href={`/admin/content/${d.links.content.id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs text-wine underline-offset-4 hover:underline">Abrir conteúdo <ExternalLink className="size-3" /></Link>}
              </Field>
              <Field label="Identidade visual">
                <Select disabled={!clientId || !rel} value={d.task.identity_project_id ?? ''} onChange={(e) => patch({ identity_project_id: e.target.value || null })}>
                  <option value="">Nenhuma</option>
                  {(rel?.identities ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
                {d.links.identity && <Link href={`/admin/identidades/${d.links.identity.id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs text-wine underline-offset-4 hover:underline">Abrir identidade <ExternalLink className="size-3" /></Link>}
              </Field>
              <Field label="Relatório">
                <Select disabled={!clientId || !rel} value={d.task.report_id ?? ''} onChange={(e) => patch({ report_id: e.target.value || null })}>
                  <option value="">Nenhum</option>
                  {(rel?.reports ?? []).map((r) => <option key={r.id} value={r.id}>{monthLabel(r.month)}</option>)}
                </Select>
                {d.links.report && <Link href={`/admin/clients/${d.links.report.client_id}/relatorios/${d.links.report.month.slice(0, 7)}`} className="mt-1.5 inline-flex items-center gap-1 text-xs text-wine underline-offset-4 hover:underline">Abrir relatório <ExternalLink className="size-3" /></Link>}
              </Field>
              <Field label="Campanha">
                <Select disabled={!clientId || !rel} value={d.task.campaign_id ?? ''} onChange={(e) => patch({ campaign_id: e.target.value || null })}>
                  <option value="">Nenhuma</option>
                  {(rel?.campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                {d.links.campaign && clientId && <Link href={`/admin/clients/${clientId}/desempenho?aba=trafego`} className="mt-1.5 inline-flex items-center gap-1 text-xs text-wine underline-offset-4 hover:underline">Abrir campanhas <ExternalLink className="size-3" /></Link>}
              </Field>
            </div>
            <p className="mt-3 text-xs text-ink/45">A tarefa só guarda a referência — nada é copiado, então não há informação duplicada.</p>
          </Section>

          <Section title="Descrição">
            <TextField label="" value={d.task.description} onSave={(v) => patch({ description: v })} multiline rows={4} placeholder="Detalhes da tarefa…" />
          </Section>

          <Section title="Checklists" action={
            <Select aria-label="Adicionar checklist" value="" onChange={(e) => e.target.value && act(() => addChecklist(taskId, e.target.value === 'blank' ? {} : { templateId: e.target.value }), 'Checklist adicionada ♡')} className="!w-auto !py-1.5 text-xs">
              <option value="">+ Adicionar checklist…</option>
              <option value="blank">Em branco</option>
              {CHECKLIST_TEMPLATES.map((t) => <option key={t.id} value={t.id}>Modelo: {t.title}</option>)}
            </Select>
          }>
            {d.checklists.length === 0 && <p className="text-sm text-ink/50">Nenhuma checklist. Use um modelo (Post, Reel, Identidade Visual…) ou crie uma em branco.</p>}
            <div className="space-y-5">
              {d.checklists.map((cl) => {
                const done = cl.items.filter((i) => i.done).length;
                const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
                return (
                  <div key={cl.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <input defaultValue={cl.title} onBlur={(e) => e.target.value.trim() && e.target.value !== cl.title && act(() => renameChecklist(cl.id, e.target.value))} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none focus:underline" aria-label="Nome da checklist" />
                      <span className="text-xs text-ink/55">{done}/{cl.items.length} concluído</span>
                      <button aria-label="Excluir checklist" onClick={() => confirm(`Excluir a checklist “${cl.title}”?`) && act(() => deleteChecklist(cl.id))} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-3.5" /></button>
                    </div>
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-blush"><div className="h-full rounded-full bg-wine transition-all" style={{ width: `${pct}%` }} /></div>
                    <ul className="space-y-1">
                      {cl.items.map((it) => (
                        <li key={it.id} className="group flex items-center gap-2.5 rounded-xl px-2 py-1 hover:bg-blush-soft">
                          <input type="checkbox" checked={it.done} onChange={(e) => act(() => updateChecklistItem(it.id, { done: e.target.checked }))} className="size-4 accent-[#771430]" aria-label={it.text} />
                          <span className={cn('min-w-0 flex-1 text-sm', it.done && 'text-ink/40 line-through')}>{it.text}</span>
                          <button aria-label="Remover item" onClick={() => act(() => deleteChecklistItem(it.id))} className="rounded-full p-1 text-wine/50 opacity-0 transition hover:bg-blush group-hover:opacity-100 focus:opacity-100"><X className="size-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                    <AddRow placeholder="Novo item…" onAdd={(t) => act(() => addChecklistItem(cl.id, t))} />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Subtarefas">
            <ul className="space-y-2">
              {d.subtasks.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-blush-soft px-3 py-2">
                  <input defaultValue={s.title} onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && act(() => updateSubtask(s.id, { title: e.target.value }))} className={cn('min-w-[8rem] flex-1 bg-transparent text-sm outline-none focus:underline', s.status === 'done' && 'text-ink/40 line-through')} aria-label="Subtarefa" />
                  <Select value={s.status} onChange={(e) => act(() => updateSubtask(s.id, { status: e.target.value }))} className="!w-auto !py-1 text-xs" aria-label="Status da subtarefa">
                    <option value="todo">A fazer</option><option value="doing">Fazendo</option><option value="done">Feita</option>
                  </Select>
                  <Select value={s.assignee_id ?? ''} onChange={(e) => act(() => updateSubtask(s.id, { assignee_id: e.target.value || null }))} className="!w-auto !py-1 text-xs" aria-label="Responsável">
                    <option value="">Sem responsável</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                  <input type="date" defaultValue={s.due_date ?? ''} onChange={(e) => act(() => updateSubtask(s.id, { due_date: e.target.value || null }))} className="rounded-full border border-wine/20 bg-white px-2.5 py-1 text-xs" aria-label="Prazo da subtarefa" />
                  <button aria-label="Excluir subtarefa" onClick={() => act(() => deleteSubtask(s.id))} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-3.5" /></button>
                </li>
              ))}
            </ul>
            <AddRow placeholder="Nova subtarefa…" onAdd={(t) => act(() => addSubtask(taskId, t))} />
          </Section>

          <Section title="Anexos e links" action={<Button variant="soft" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-3.5" /> Anexar arquivo</Button>}>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
            <ul className="space-y-1.5">
              {d.attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-blush-soft px-3 py-2 text-sm">
                  {a.kind === 'file' && a.mime_type.startsWith('image/') && a.signed ? (
                    <img src={a.signed} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg object-cover" />
                  ) : a.kind === 'link' ? <Link2 className="size-4 shrink-0 text-wine" /> : <FileText className="size-4 shrink-0 text-wine" />}
                  <a href={a.kind === 'link' ? a.url : (a.signed ?? '#')} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-wine underline-offset-4 hover:underline">{a.name}</a>
                  {a.kind === 'link' && <span className="text-xs text-ink/45">{LINK_TYPES.find((l) => l.id === a.link_type)?.label}</span>}
                  <button aria-label="Remover anexo" onClick={() => act(() => deleteAttachment(a.id))} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-3.5" /></button>
                </li>
              ))}
              {d.attachments.length === 0 && <li className="text-sm text-ink/50">Nenhum anexo. Anexe arquivos ou cole links do Drive, Canva, Figma, Instagram…</li>}
            </ul>
            <LinkAdder onAdd={(url, name) => act(() => addAttachmentLink(taskId, { url, name, link_type: guessLinkType(url) }), 'Link adicionado ♡')} />
            <p className="mt-2 text-xs text-ink/45"><Paperclip className="mr-1 inline size-3" />Se o arquivo já existe em um conteúdo, vincule o conteúdo acima em vez de anexar de novo.</p>
          </Section>

          <Section title="Comentários internos">
            <ul className="mb-3 space-y-3">
              {d.comments.map((c) => (
                <li key={c.id} className="group rounded-2xl bg-blush-soft px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-ink/50"><strong className="font-normal text-wine">{c.author_name || 'Soltria'}</strong><span>{fmtStamp(c.created_at)}</span>
                    <button aria-label="Excluir comentário" onClick={() => act(() => deleteComment(c.id))} className="ml-auto rounded-full p-1 text-wine/50 opacity-0 hover:bg-blush group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-3" /></button>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink/85">{c.body}</p>
                </li>
              ))}
              {d.comments.length === 0 && <li className="text-sm text-ink/50">Sem comentários ainda.</li>}
            </ul>
            <CommentBox onSend={(t) => act(() => addComment(taskId, t))} />
          </Section>

          <Section title="Observações internas">
            <TextField label="" value={d.task.internal_notes} onSave={(v) => patch({ internal_notes: v })} multiline rows={3} placeholder="Só você vê. Nunca aparece para o cliente." />
          </Section>

          <Section title="Histórico">
            <ul className="space-y-2 text-sm">
              {d.activity.map((a) => (
                <li key={a.id} className="flex gap-3"><span className="w-24 shrink-0 text-xs text-ink/45">{fmtStamp(a.created_at)}</span><span className="text-ink/75">{a.detail || a.action}</span></li>
              ))}
              {d.activity.length === 0 && <li className="text-ink/50">Sem registros.</li>}
            </ul>
            <p className="mt-3 text-xs text-ink/40">O histórico nunca é apagado.</p>
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-wine/10 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setDup(true)}><Copy className="size-3.5" /> Duplicar tarefa</Button>
              <Button variant="ghost" size="sm" onClick={() => act(() => archiveTask(taskId, !d.task.archived), d.task.archived ? 'Tarefa restaurada' : 'Tarefa arquivada', ).then(() => !d.task.archived && onClose())}>
                {d.task.archived ? <><ArchiveRestore className="size-3.5" /> Restaurar</> : <><Archive className="size-3.5" /> Arquivar</>}
              </Button>
            </div>
            <Button variant="danger" size="sm" onClick={() => confirm('Excluir esta tarefa e tudo dentro dela? Não dá para desfazer.') && act(() => deleteTask(taskId), 'Tarefa excluída').then(onClose)}><Trash2 className="size-3.5" /> Excluir</Button>
          </div>
        </div>
      )}

      {dup && d && (
        <Modal open onClose={() => setDup(false)} title="Duplicar tarefa" className="sm:!max-w-md">
          <p className="mb-3 text-sm text-ink/65">Copia descrição, checklist (zerada), tags e categoria. Marque o que mais deve ir junto:</p>
          {([['keepClient', 'Cliente e vínculos'], ['keepDue', 'Prazo e datas'], ['keepAssignees', 'Responsáveis']] as const).map(([k, l]) => (
            <label key={k} className="mb-2 flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#771430]" checked={dupOpts[k]} onChange={(e) => setDupOpts((s) => ({ ...s, [k]: e.target.checked }))} /> {l}</label>
          ))}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDup(false)}>Cancelar</Button>
            <Button onClick={() => act(() => duplicateTask(taskId, dupOpts), 'Tarefa duplicada ♡').then(() => setDup(false))}>Duplicar</Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (t: string) => void }) {
  const [t, setT] = useState('');
  const submit = () => {
    if (!t.trim()) return;
    onAdd(t);
    setT('');
  };
  return (
    <div className="mt-2 flex gap-2">
      <Input value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())} className="!py-2 text-sm" />
      <Button variant="soft" size="sm" onClick={submit} disabled={!t.trim()}><Plus className="size-3.5" /> Adicionar</Button>
    </div>
  );
}
function LinkAdder({ onAdd }: { onAdd: (url: string, name: string) => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (Drive, Canva, Figma, Instagram, site)" className="!py-2 text-sm" />
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional)" className="!py-2 text-sm" />
      <Button variant="soft" size="sm" disabled={!url.trim()} onClick={() => { onAdd(url, name); setUrl(''); setName(''); }}><Link2 className="size-3.5" /> Adicionar link</Button>
    </div>
  );
}
function CommentBox({ onSend }: { onSend: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <div>
      <Textarea rows={2} value={t} onChange={(e) => setT(e.target.value)} placeholder="Escreva um comentário interno…" />
      <div className="mt-2 flex justify-end"><Button size="sm" disabled={!t.trim()} onClick={() => { onSend(t); setT(''); }}>Comentar</Button></div>
    </div>
  );
}
function TagPicker({ tags, selected, onChange, onCreated }: { tags: TagRow[]; selected: string[]; onChange: (ids: string[]) => void; onCreated: (t: TagRow) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const toast = useToast();
  return (
    <div>
      <p className="label mb-2 text-wine">Tags</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button key={t.id} type="button" aria-pressed={on} onClick={() => onChange(on ? selected.filter((x) => x !== t.id) : [...selected, t.id])} className="rounded-full border px-3 py-1 text-[0.78rem] transition" style={on ? { background: t.color, borderColor: t.color, color: '#fff' } : { borderColor: `${t.color}66`, color: t.color }}>
              {t.name}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova tag (ex.: URGENTE, CAMPANHA)" className="!w-56 !py-2 text-sm" maxLength={40} />
        <div className="flex gap-1">{TAG_COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setColor(c)} className={cn('size-6 rounded-full ring-offset-2', color === c && 'ring-2 ring-wine')} style={{ background: c }} />)}</div>
        <Button variant="soft" size="sm" disabled={!name.trim()} onClick={async () => {
          const r = await createTag(name, color);
          if (!r.ok) return toast(r.error, 'error');
          const t: TagRow = { id: r.id, name: name.trim(), color };
          onCreated(t);
          onChange([...selected, r.id]);
          setName('');
        }}>Criar tag</Button>
      </div>
    </div>
  );
}
