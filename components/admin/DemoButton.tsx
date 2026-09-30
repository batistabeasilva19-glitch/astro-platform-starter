'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { loadDemoData } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function DemoButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await loadDemoData();
          if (!r.ok) return toast(r.error, 'error');
          toast('Dados de demonstração criados ♡');
          router.push(`/admin/clients/${r.clientId}`);
        })
      }
    >
      <Sparkles className="size-4" /> Carregar dados de demonstração
    </Button>
  );
}
