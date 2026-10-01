'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { createIdentityProject, updateIdentityProject } from '@/lib/actions/identity';
import type { ActionResult } from '@/lib/actions/shared';
import { IDENTITY_STATUSES, IDENTITY_STATUS_META, type IdentityProject } from '@/lib/identity/types';
import { Button, buttonClass } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';

export function ProjectForm({ clients, clientId, project }: { clients: { id: string; company_name: string }[]; clientId?: string; project?: IdentityProject }) {
  const editing = !!project;
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(editing ? updateIdentityProject : createIdentityProject, null);
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) toast('Alterações salvas ♡');
  }, [state, toast]);

  return (
    <form action={action} className="space-y-5">
      {editing && <input type="hidden" name="id" value={project!.id} />}
      {editing && <input type="hidden" name="client_id" value={project!.client_id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Cliente *" hint={editing ? undefined : 'Escolha um cliente já cadastrado ou cadastre um novo.'}>
          {editing ? (
            <Input value={clients.find((c) => c.id === project!.client_id)?.company_name ?? ''} disabled />
          ) : (
            <Select name="client_id" required defaultValue={clientId ?? ''}>
              <option value="" disabled>Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </Select>
          )}
        </Field>
        {!editing && (
          <div className="flex items-end">
            <Link href="/admin/clients/new?next=/admin/identidades/new" className={buttonClass('outline', 'md', 'w-full sm:w-auto')}>
              <UserPlus className="size-4" /> Novo cliente
            </Link>
          </div>
        )}
        <Field label="Nome do projeto *" className="sm:col-span-2">
          <Input name="name" required defaultValue={project?.name} placeholder="Identidade Visual 2026" />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Textarea name="description" rows={3} defaultValue={project?.description} placeholder="Do que se trata este projeto?" />
        </Field>
        <Field label="Data de início">
          <Input type="date" name="start_date" defaultValue={project?.start_date ?? ''} />
        </Field>
        <Field label="Status" hint="Ajustado automaticamente conforme as etapas. Use “Finalizado” para encerrar.">
          <Select name="status" defaultValue={project?.status ?? 'in_creation'}>
            {IDENTITY_STATUSES.map((s) => (
              <option key={s} value={s}>{IDENTITY_STATUS_META[s].label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Observações internas" className="sm:col-span-2" hint="Só você vê — não aparece para o cliente.">
          <Textarea name="internal_notes" rows={3} defaultValue={project?.internal_notes} />
        </Field>
      </div>
      <FormMessage error={state && !state.ok ? state.error : null} />
      <div className="flex flex-wrap justify-end gap-3">
        {!editing && <Link href="/admin/identidades" className={buttonClass('ghost')}>Cancelar</Link>}
        <Button type="submit" loading={pending}>{editing ? 'Salvar alterações' : 'Criar identidade visual'}</Button>
      </div>
    </form>
  );
}
