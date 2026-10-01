'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ExternalLink, FileText, Loader2, Pencil, Save, Trash2, UploadCloud, X } from 'lucide-react';
import { deleteStrategyDoc, registerStrategyDoc, updateStrategyDoc } from '@/lib/actions/strategy';
import { currentMonth, fmtSize, groupByMonth, monthLabel, monthKey, type StrategyDoc } from '@/lib/strategy';
import { uploadToStorage } from '@/lib/upload';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';

type Doc = StrategyDoc & { url: string };
const MAX_MB = 50;

/** Área da administradora: sobe PDFs por mês, edita, oculta/mostra para o cliente e exclui. */
export function StrategyManager({ ownerId, clientId, docs }: { ownerId: string; clientId: string; docs: Doc[] }) {
  const [month, setMonth] = useState(currentMonth());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('todos');
  const [edit, setEdit] = useState<Doc | null>(null);
  const [staged, setStaged] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function stage(files: File[]) {
    if (!files.length) return;
    setError(null);
    for (const f of files) {
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) return setError(`“${f.name}” não é um PDF.`);
      if (f.size > MAX_MB * 1024 * 1024) return setError(`“${f.name}” tem mais de ${MAX_MB} MB.`);
    }
    setStaged((cur) => [...cur, ...files]);
  }

  async function save() {
    const files = staged;
    if (!files.length) return setError('Escolha pelo menos um PDF antes de salvar.');
    setBusy(true);
    try {
      for (const f of files) {
        const path = await uploadToStorage(f, `${ownerId}/${clientId}/strategy/${month}`);
        const r = await registerStrategyDoc({ clientId, month, title: files.length === 1 ? title : '', description, path, fileName: f.name, size: f.size });
        if (!r.ok) throw new Error(r.error);
      }
      toast(files.length > 1 ? `${files.length} PDFs enviados ♡` : 'PDF enviado ♡');
      setTitle('');
      setDescription('');
      setStaged([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no envio.');
    } finally {
      setBusy(false);
    }
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Erro', 'error');
      toast(msg);
      after?.();
      router.refresh();
    });

  const months = groupByMonth(docs);
  const shown = filter === 'todos' ? months : months.filter((g) => g.month === filter);

  return (
    <div className="space-y-10">
      {/* enviar */}
      <section className="card p-5 sm:p-7">
        <h2 className="h-display mb-1 text-2xl text-wine">Enviar PDF</h2>
        <p className="mb-5 text-sm text-ink/60">Escolha o mês a que a estratégia pertence. Você pode selecionar vários PDFs de uma vez.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mês da estratégia">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="Título (opcional)" hint="Vazio = usa o nome do arquivo. Com vários PDFs, cada um usa o próprio nome.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Estratégia de conteúdo — Outubro" />
          </Field>
          <Field label="Descrição (opcional)" className="sm:col-span-2">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Um resumo do que o cliente vai encontrar no documento." />
          </Field>
        </div>
        <div className="mt-4">
          <FormMessage error={error} />
        </div>
        <button
          type="button"
          disabled={busy || !month}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            stage([...e.dataTransfer.files]);
          }}
          className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-wine/30 px-6 py-9 text-center text-wine transition hover:border-wine hover:bg-blush disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <UploadCloud className="size-6" />}
          <span className="text-sm">{busy ? 'Enviando…' : `Clique ou arraste os PDFs de ${monthLabel(month)}`}</span>
          <span className="text-xs text-ink/50">Somente PDF · depois clique em Salvar · até {MAX_MB} MB cada</span>
        </button>
        {staged.length > 0 && (
          <ul className="mt-4 space-y-2">
            {staged.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-2xl bg-blush px-4 py-2.5 text-sm text-wine">
                <FileText className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-ink/50">{fmtSize(f.size)}</span>
                <button type="button" disabled={busy} aria-label="Remover da lista" onClick={() => setStaged((c) => c.filter((_, j) => j !== i))} className="rounded-full p-1 hover:bg-white"><X className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-end">
          <Button type="button" loading={busy} disabled={!staged.length || !month} onClick={save}>
            <Save className="size-4" /> Salvar{staged.length > 1 ? ` ${staged.length} PDFs` : ''}
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { stage([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </section>

      {/* lista por mês */}
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-display text-3xl text-wine">Documentos <span className="label align-middle text-ink/40">{docs.length}</span></h2>
          {months.length > 1 && (
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto !py-2 text-sm" aria-label="Filtrar por mês">
              <option value="todos">Todos os meses</option>
              {months.map((g) => (
                <option key={g.month} value={g.month}>{monthLabel(g.month)} ({g.docs.length})</option>
              ))}
            </Select>
          )}
        </div>
        {docs.length === 0 ? (
          <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum PDF ainda. Envie o primeiro acima.</p>
        ) : (
          <div className="space-y-8">
            {shown.map((g) => (
              <div key={g.month}>
                <p className="label mb-3 text-wine">{monthLabel(g.month)}</p>
                <ul className="space-y-2">
                  {g.docs.map((d) => (
                    <li key={d.id} className={cn('card flex flex-wrap items-center gap-3 p-4', !d.visible && 'bg-ink/[0.03]')}>
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blush text-wine"><FileText className="size-5" /></span>
                      <span className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-0">
                        <span className="block truncate text-sm">{d.title}</span>
                        <span className="block truncate text-xs text-ink/50">{d.file_name} · {fmtSize(d.size_bytes)} · enviado {fmtStamp(d.created_at)}</span>
                        {d.description && <span className="mt-0.5 block text-xs text-ink/60">{d.description}</span>}
                      </span>
                      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                        <span className={cn('rounded-full px-3 py-1 text-xs', d.visible ? 'bg-wine text-white' : 'bg-ink/5 text-ink/60')}>{d.visible ? 'Visível ao cliente' : 'Oculto'}</span>
                        <div className="flex gap-1">
                          <a href={d.url} target="_blank" rel="noreferrer" aria-label="Abrir PDF" className="rounded-full p-2 text-wine transition hover:bg-blush"><ExternalLink className="size-4" /></a>
                          <button aria-label={d.visible ? 'Ocultar do cliente' : 'Mostrar ao cliente'} onClick={() => run(() => updateStrategyDoc(d.id, { visible: !d.visible }), d.visible ? 'Oculto para o cliente' : 'Visível para o cliente ♡')} className="rounded-full p-2 text-wine transition hover:bg-blush">{d.visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                          <button aria-label="Editar" onClick={() => setEdit(d)} className="rounded-full p-2 text-wine transition hover:bg-blush"><Pencil className="size-4" /></button>
                          <button aria-label="Excluir" onClick={() => confirm(`Excluir “${d.title}”? O arquivo também será apagado.`) && run(() => deleteStrategyDoc(d.id), 'Documento excluído')} className="rounded-full p-2 text-wine transition hover:bg-blush"><Trash2 className="size-4" /></button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {edit && <EditModal key={edit.id} doc={edit} onClose={() => setEdit(null)} pending={pending} onSave={(patch) => run(() => updateStrategyDoc(edit.id, patch), 'Salvo ♡', () => setEdit(null))} />}
    </div>
  );
}

function EditModal({ doc, onClose, onSave, pending }: { doc: Doc; onClose: () => void; onSave: (p: { title: string; description: string; month: string }) => void; pending: boolean }) {
  const [t, setT] = useState(doc.title);
  const [d, setD] = useState(doc.description);
  const [m, setM] = useState(monthKey(doc.month));
  return (
    <Modal open onClose={onClose} title="Editar documento">
      <div className="space-y-4">
        <Field label="Título"><Input value={t} onChange={(e) => setT(e.target.value)} /></Field>
        <Field label="Mês"><Input type="month" value={m} onChange={(e) => setM(e.target.value)} /></Field>
        <Field label="Descrição"><Textarea rows={3} value={d} onChange={(e) => setD(e.target.value)} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button loading={pending} disabled={!t.trim() || !m} onClick={() => onSave({ title: t, description: d, month: m })}>Salvar</Button>
      </div>
    </Modal>
  );
}
