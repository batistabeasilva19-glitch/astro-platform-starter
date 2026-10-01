import { allColors, getFonts, getPalettes } from './color';
import { latestLogoVersion, type ApprovalSnapshot, type ColorItem, type FavKind, type FontItem, type IdentityDetail, type Palette, type SignedAsset, type StageData } from './types';

export type FavoriteItem =
  | { kind: 'logo'; refId: string; label: string; imageUrl: string | null }
  | { kind: 'palette'; refId: string; label: string; palette: Palette }
  | { kind: 'color'; refId: string; label: string; color: ColorItem }
  | { kind: 'font'; refId: string; label: string; font: FontItem }
  | { kind: 'application'; refId: string; label: string; imageUrl: string | null; asset: SignedAsset };

const currentContent = (s?: StageData) => (s?.versions.find((v) => v.version_number === s.current_version) ?? s?.versions[s.versions.length - 1])?.content;
const stageOf = (d: IdentityDetail, key: string) => d.stages.find((s) => s.stage_key === key);

/** Resolve os favoritos do cliente (ids) em itens com visual. Ignora o que não existe mais. */
export function resolveFavorites(d: IdentityDetail): Record<FavKind, FavoriteItem[]> {
  const out: Record<FavKind, FavoriteItem[]> = { logo: [], palette: [], color: [], font: [], application: [] };
  const palettes = getPalettes(currentContent(stageOf(d, 'colors')) ?? {});
  const colors = allColors(currentContent(stageOf(d, 'colors')) ?? {});
  const fonts = getFonts(currentContent(stageOf(d, 'typography')) ?? {});
  const apps = stageOf(d, 'applications')?.versions.flatMap((v) => v.assets) ?? [];

  for (const f of d.favorites) {
    if (f.kind === 'logo') {
      const p = stageOf(d, 'logo')?.proposals.find((x) => x.id === f.ref_id);
      if (!p) continue;
      const lv = latestLogoVersion(p);
      const img = lv?.assets.find((a) => a.slot === 'primary') ?? lv?.assets[0];
      out.logo.push({ kind: 'logo', refId: p.id, label: `${p.label} · V${lv?.version_number ?? 1}`, imageUrl: img?.url ?? null });
    } else if (f.kind === 'palette') {
      const p = palettes.find((x) => x.id === f.ref_id);
      if (p) out.palette.push({ kind: 'palette', refId: p.id, label: p.label, palette: p });
    } else if (f.kind === 'color') {
      const c = colors.find((x) => x.id === f.ref_id);
      if (c) out.color.push({ kind: 'color', refId: c.id, label: `${c.name || 'Cor'} ${c.hex.toUpperCase()}`, color: c });
    } else if (f.kind === 'font') {
      const x = fonts.find((y) => y.id === f.ref_id);
      if (x) out.font.push({ kind: 'font', refId: x.id, label: x.name, font: x });
    } else {
      const a = apps.find((y) => y.id === f.ref_id);
      if (a) out.application.push({ kind: 'application', refId: a.id, label: a.name || a.caption || a.file_name || 'Aplicação', imageUrl: a.url, asset: a });
    }
  }
  return out;
}

/** Último snapshot de aprovação (o que foi aprovado e quando) de uma etapa. */
export function lastApproval(d: IdentityDetail, key: string) {
  const s = stageOf(d, key);
  const a = [...(s?.approvals ?? [])].reverse().find((x) => x.action === 'approved');
  return a ? { ...a, snapshot: (a.snapshot ?? {}) as ApprovalSnapshot } : null;
}

export const FAV_LABEL: Record<FavKind, string> = { logo: 'Logos', palette: 'Paletas', color: 'Cores', font: 'Tipografias', application: 'Aplicações' };
export const FAV_STAGE: Record<FavKind, string> = { logo: 'logo', palette: 'colors', color: 'colors', font: 'typography', application: 'applications' };
