'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Columns2, SlidersHorizontal } from 'lucide-react';
import { LOGO_SLOTS, type LogoVersionData, type ProposalData } from '@/lib/identity/types';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Fields';
import { cn, fmtFullDate } from '@/lib/utils';

const SLOT_LABEL = Object.fromEntries(LOGO_SLOTS) as Record<string, string>;

/** COMPARAR VERSÕES: lado a lado (desktop), alternar (celular) e slider ANTES ↔ DEPOIS. */
export function VersionCompare({ proposal, open, onClose, initialA, initialB }: { proposal: ProposalData; open: boolean; onClose: () => void; initialA: string; initialB: string }) {
  const [aId, setA] = useState(initialA);
  const [bId, setB] = useState(initialB);
  const [slot, setSlot] = useState('primary');
  const [mode, setMode] = useState<'side' | 'slider'>('side');
  const [mobile, setMobile] = useState<'a' | 'b'>('b');
  const [pos, setPos] = useState(50);

  const a = proposal.versions.find((v) => v.id === aId) ?? proposal.versions[0];
  const b = proposal.versions.find((v) => v.id === bId) ?? proposal.versions[proposal.versions.length - 1];
  const slots = useMemo(() => {
    const present = new Set([...a.assets, ...b.assets].map((x) => x.slot));
    return LOGO_SLOTS.map(([s]) => s as string).filter((s) => present.has(s));
  }, [a, b]);
  const slotNow = slots.includes(slot) ? slot : (slots[0] ?? 'primary');
  const imgA = a.assets.find((x) => x.slot === slotNow);
  const imgB = b.assets.find((x) => x.slot === slotNow);
  const dark = slotNow === 'light';

  const Label = ({ v }: { v: LogoVersionData }) => (
    <span>
      V{v.version_number} <span className="text-ink/45">· {fmtFullDate(v.created_at)}</span>
    </span>
  );

  const Pane = ({ v, img, tag }: { v: LogoVersionData; img?: { url: string }; tag?: string }) => (
    <figure>
      <div className={cn('flex h-64 items-center justify-center rounded-3xl border border-wine/15 p-6 sm:h-80', dark ? 'bg-ink' : 'bg-white')}>
        {img ? <img loading="lazy" decoding="async" src={img.url} alt={`V${v.version_number}`} className="max-h-full max-w-full object-contain" /> : <span className={cn('text-sm', dark ? 'text-white/60' : 'text-ink/45')}>Sem arquivo nesta versão</span>}
      </div>
      <figcaption className="label mt-2 text-center text-wine">{tag ?? `Versão ${String(v.version_number).padStart(2, '0')}`}</figcaption>
    </figure>
  );

  return (
    <Modal open={open} onClose={onClose} title={`Comparar versões — ${proposal.label}`} className="sm:!max-w-4xl">
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-end">
        <label className="block">
          <span className="label mb-1.5 block text-wine/70">Versão</span>
          <Select value={aId} onChange={(e) => setA(e.target.value)} aria-label="Primeira versão">
            {proposal.versions.map((v) => (
              <option key={v.id} value={v.id}>V{v.version_number} · {fmtFullDate(v.created_at)}</option>
            ))}
          </Select>
        </label>
        <span className="hidden items-center justify-center pb-3 text-wine sm:flex"><span className="label">VS</span></span>
        <label className="block">
          <span className="label mb-1.5 block text-wine/70">Versão</span>
          <Select value={bId} onChange={(e) => setB(e.target.value)} aria-label="Segunda versão">
            {proposal.versions.map((v) => (
              <option key={v.id} value={v.id}>V{v.version_number} · {fmtFullDate(v.created_at)}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="label mb-1.5 block text-wine/70">Arquivo</span>
          <Select value={slotNow} onChange={(e) => setSlot(e.target.value)} aria-label="Qual arquivo comparar">
            {(slots.length ? slots : ['primary']).map((s) => (
              <option key={s} value={s}>{SLOT_LABEL[s] ?? s}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="mb-5 inline-flex rounded-full border border-wine/25 bg-white p-1">
        <button onClick={() => setMode('side')} aria-pressed={mode === 'side'} className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-xs transition', mode === 'side' ? 'bg-wine text-white' : 'text-wine hover:bg-blush')}>
          <Columns2 className="size-3.5" /> <span className="hidden sm:inline">Lado a lado</span><span className="sm:hidden">Alternar</span>
        </button>
        <button onClick={() => setMode('slider')} aria-pressed={mode === 'slider'} className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-xs transition', mode === 'slider' ? 'bg-wine text-white' : 'text-wine hover:bg-blush')}>
          <SlidersHorizontal className="size-3.5" /> Antes ↔ Depois
        </button>
      </div>

      {mode === 'side' ? (
        <>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2">
            <Pane v={a} img={imgA} />
            <Pane v={b} img={imgB} />
          </div>
          <div className="sm:hidden">
            <div className="mb-3 flex justify-center gap-2">
              {([['a', a], ['b', b]] as const).map(([k, v]) => (
                <button key={k} onClick={() => setMobile(k)} aria-pressed={mobile === k} className={cn('rounded-full border px-4 py-1.5 text-xs transition', mobile === k ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine')}>
                  V{v.version_number}
                </button>
              ))}
              <button onClick={() => setMobile(mobile === 'a' ? 'b' : 'a')} aria-label="Alternar versão" className="rounded-full border border-wine/30 p-2 text-wine"><ArrowLeftRight className="size-3.5" /></button>
            </div>
            {mobile === 'a' ? <Pane v={a} img={imgA} /> : <Pane v={b} img={imgB} />}
          </div>
        </>
      ) : (
        <div>
          <div className={cn('relative h-72 select-none overflow-hidden rounded-3xl border border-wine/15 sm:h-96', dark ? 'bg-ink' : 'bg-white')}>
            {/* depois (versão B) por baixo */}
            <div className="absolute inset-0 flex items-center justify-center p-6">{imgB ? <img loading="lazy" decoding="async" src={imgB.url} alt="Depois" className="max-h-full max-w-full object-contain" /> : null}</div>
            {/* antes (versão A) recortada pela esquerda */}
            <div className={cn('absolute inset-0 flex items-center justify-center p-6', dark ? 'bg-ink' : 'bg-white')} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              {imgA ? <img loading="lazy" decoding="async" src={imgA.url} alt="Antes" className="max-h-full max-w-full object-contain" /> : null}
            </div>
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-wine" style={{ left: `${pos}%` }}>
              <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-wine text-white shadow"><ArrowLeftRight className="size-4" /></span>
            </div>
            <span className="label pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-wine">Antes · V{a.version_number}</span>
            <span className="label pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-wine">Depois · V{b.version_number}</span>
            <input type="range" min={0} max={100} step={0.5} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Arraste para comparar antes e depois" className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
          </div>
          <p className="mt-2 text-center text-xs text-ink/55">Arraste para a esquerda e para a direita: o lado esquerdo mostra a versão antiga e o direito, a nova.</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        {[a, b].map((v, i) => (
          <div key={`${v.id}-${i}`} className="rounded-2xl bg-blush/60 p-4">
            <p className="label mb-1 text-wine"><Label v={v} /></p>
            <p className="whitespace-pre-line text-ink/75">{v.changes || 'Sem descrição de alterações.'}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}
