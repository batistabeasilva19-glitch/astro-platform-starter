'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { createContent, updateContent } from '@/lib/actions/content';
import type { ActionResult } from '@/lib/actions/shared';
import type { ContentFormat, ContentItem, ContentVersion } from '@/lib/types';
import { FORMATS, FORMAT_META, STATUSES, STATUS_META } from '@/lib/constants';
import { Button, buttonClass } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { FormatIcon } from '@/components/content/Badges';
import { cn } from '@/lib/utils';

interface Props {
  clients: { id: string; company_name: string }[];
  clientId: string;
  defaultDate?: string;
  content?: ContentItem;
  version?: ContentVersion;
  /** false ao editar uma versão antiga (campos de legenda ficam bloqueados). */
  editable?: boolean;
}

export function ContentForm({ clients, clientId, defaultDate, content, version, editable = true }: Props) {
  const editing = !!content;
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(editing ? updateContent : createContent, null);
  const [format, setFormat] = useState<ContentFormat>(content?.format ?? 'post');
  const toast = useToast();

  useEffect(() => {
    if (state?.ok) toast('Alterações salvas ♡');
  }, [state, toast]);

  return (
    <form action={action} className="space-y-6">
      {editing && <input type="hidden" name="id" value={content!.id} />}
      {editing && <input type="hidden" name="client_id" value={content!.client_id} />}
      <input type="hidden" name="format" value={format} />

      <div>
        <p className="label mb-2 text-wine">Formato</p>
        <div className="grid grid-cols-5 gap-2">
          {FORMATS.map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-[0.72rem] transition',
                format === f ? 'border-wine bg-wine text-white' : 'border-wine/20 bg-white text-wine hover:bg-blush',
              )}
            >
              <FormatIcon format={f} className="size-5" />
              {FORMAT_META[f].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Título interno *" className="sm:col-span-2">
          <Input name="title" required defaultValue={content?.title} placeholder="Ex.: Post de boas-vindas" />
        </Field>
        <Field label="Cliente">
          {editing ? (
            <Input value={clients.find((c) => c.id === content!.client_id)?.company_name ?? ''} disabled />
          ) : (
            <Select name="client_id" defaultValue={clientId}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={content?.status ?? 'draft'}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Data prevista de publicação">
          <Input type="date" name="scheduled_date" defaultValue={content?.scheduled_date ?? defaultDate ?? ''} />
        </Field>
        <Field label="Horário">
          <Input type="time" name="scheduled_time" defaultValue={content?.scheduled_time?.slice(0, 5) ?? ''} />
        </Field>
        <Field label="Objetivo do conteúdo" className="sm:col-span-2">
          <Input name="objective" defaultValue={content?.objective} placeholder="Ex.: Gerar agendamentos / educar / engajar" />
        </Field>
        <Field label="Legenda" className="sm:col-span-2" hint={editing ? `Versão ${String(version?.version_number ?? 1).padStart(2, '0')}` : undefined}>
          <Textarea name="caption" rows={6} defaultValue={version?.caption} disabled={!editable} placeholder="Escreva a legenda do post…" />
        </Field>
        <Field label="CTA (chamada para ação)">
          <Input name="cta" defaultValue={version?.cta} disabled={!editable} placeholder="Ex.: Agende pelo link da bio" />
        </Field>
        <Field label="Hashtags">
          <Input name="hashtags" defaultValue={version?.hashtags} disabled={!editable} placeholder="#estetica #autocuidado" />
        </Field>
        {(format === 'reel' || format === 'video') && (
          <Field label="Duração do vídeo (segundos)" hint="Preenchida automaticamente ao subir o vídeo; ajuste se quiser.">
            <Input type="number" min={0} name="duration_seconds" defaultValue={version?.duration_seconds ?? ''} disabled={!editable} />
          </Field>
        )}
        <Field label="Observações internas" className="sm:col-span-2" hint="Só você vê — não aparece para o cliente.">
          <Textarea name="internal_notes" rows={3} defaultValue={content?.internal_notes} />
        </Field>
      </div>

      <FormMessage error={state && !state.ok ? state.error : null} />
      <div className="flex flex-wrap justify-end gap-3">
        {!editing && (
          <Link href={`/admin/clients/${clientId}`} className={buttonClass('ghost')}>Cancelar</Link>
        )}
        <Button type="submit" loading={pending}>{editing ? 'Salvar alterações' : 'Criar e subir artes'}</Button>
      </div>
    </form>
  );
}
