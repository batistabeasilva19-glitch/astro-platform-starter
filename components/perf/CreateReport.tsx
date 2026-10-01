'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { createReport } from '@/lib/actions/perf';
import { Button } from '@/components/ui/Button';
import { FormMessage, Input } from '@/components/ui/Fields';
import { todayBR } from '@/lib/perf/calc';

/** "Gerar relatório do mês": cria o rascunho já preenchido com os dados cadastrados e abre o editor. */
export function CreateReport({ clientId, defaultMonth }: { clientId: string; defaultMonth?: string }) {
  const [month, setMonth] = useState(defaultMonth ?? todayBR().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="h-display text-2xl text-wine">Gerar relatório do mês</h2>
      <p className="mt-1 text-sm text-ink/60">O sistema busca sozinho os dados do perfil, os resultados de cada conteúdo, o tráfego pago, os rankings, os gráficos e a comparação com o mês anterior. Você só revisa e escreve a sua análise.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="!w-auto" aria-label="Mês do relatório" />
        <Button
          loading={pending}
          onClick={() => start(async () => {
            setError(null);
            const r = await createReport(clientId, `${month}-01`);
            if (!r.ok) return setError(r.error);
            router.push(`/admin/clients/${clientId}/relatorios/${r.month.slice(0, 7)}`);
          })}
        >
          <Sparkles className="size-4" /> Gerar relatório do mês
        </Button>
      </div>
      <div className="mt-3"><FormMessage error={error} /></div>
    </div>
  );
}
