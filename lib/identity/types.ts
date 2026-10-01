/** Tipos e constantes do módulo IDENTIDADE VISUAL (independente do módulo de conteúdo). */
import {
  BookOpenText,
  Check,
  FileArchive,
  Fingerprint,
  Layers,
  LayoutGrid,
  Palette,
  Shapes,
  Type,
  type LucideIcon,
} from 'lucide-react';

export type StageKey =
  | 'concept'
  | 'moodboard'
  | 'logo'
  | 'colors'
  | 'typography'
  | 'elements'
  | 'applications'
  | 'final'
  | 'files';

export type StageStatus = 'draft' | 'awaiting' | 'changes_requested' | 'approved';
export type IdentityStatus = 'in_creation' | 'awaiting_approval' | 'changes_requested' | 'approved' | 'finalized';

export interface StageMeta {
  key: StageKey;
  number: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** false = etapa de entrega (Arquivos): sem aprovação. */
  approvable: boolean;
  hint: string;
}

export const STAGES: StageMeta[] = [
  { key: 'concept', number: '01', label: 'Conceito', short: 'Conceito', icon: BookOpenText, approvable: true, hint: 'A apresentação textual da marca.' },
  { key: 'moodboard', number: '02', label: 'Moodboard', short: 'Moodboard', icon: LayoutGrid, approvable: true, hint: 'Referências visuais da direção criativa.' },
  { key: 'logo', number: '03', label: 'Logo', short: 'Logo', icon: Fingerprint, approvable: true, hint: 'Propostas de logo, favoritos e escolha.' },
  { key: 'colors', number: '04', label: 'Cores', short: 'Cores', icon: Palette, approvable: true, hint: 'A paleta oficial da marca.' },
  { key: 'typography', number: '05', label: 'Tipografia', short: 'Tipografia', icon: Type, approvable: true, hint: 'Fontes e hierarquia de texto.' },
  { key: 'elements', number: '06', label: 'Elementos', short: 'Elementos', icon: Shapes, approvable: true, hint: 'Padrões, ícones e elementos gráficos.' },
  { key: 'applications', number: '07', label: 'Aplicações', short: 'Aplicações', icon: Layers, approvable: true, hint: 'A identidade aplicada em peças reais.' },
  { key: 'final', number: '08', label: 'Aprovação final', short: 'Finalização', icon: Check, approvable: true, hint: 'A aprovação de toda a identidade.' },
  { key: 'files', number: '09', label: 'Arquivos', short: 'Arquivos', icon: FileArchive, approvable: false, hint: 'Entregáveis para download.' },
];

export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, StageMeta>;
export const isStageKey = (k: string): k is StageKey => k in STAGE_BY_KEY;

export const STAGE_STATUS_META: Record<StageStatus, { label: string; client: string; chip: string; symbol: '✓' | '●' | '○' }> = {
  draft: { label: 'Em criação', client: 'Em preparo', chip: 'bg-ink/5 text-ink/70 border-ink/15', symbol: '○' },
  awaiting: { label: 'Aguardando aprovação', client: 'Aguardando sua aprovação', chip: 'bg-blush text-wine border-wine/25', symbol: '●' },
  changes_requested: { label: 'Alteração solicitada', client: 'Alteração solicitada', chip: 'bg-white text-wine border-wine border-dashed', symbol: '●' },
  approved: { label: 'Aprovado', client: 'Aprovado ♡', chip: 'bg-wine text-white border-wine', symbol: '✓' },
};

export const IDENTITY_STATUS_META: Record<IdentityStatus, { label: string; client: string; chip: string }> = {
  in_creation: { label: 'Em criação', client: 'Em criação', chip: 'bg-ink/5 text-ink/70 border-ink/15' },
  awaiting_approval: { label: 'Aguardando aprovação', client: 'Aguardando sua aprovação', chip: 'bg-blush text-wine border-wine/25' },
  changes_requested: { label: 'Alteração solicitada', client: 'Alteração solicitada', chip: 'bg-white text-wine border-wine border-dashed' },
  approved: { label: 'Aprovado', client: 'Aprovado ♡', chip: 'bg-wine text-white border-wine' },
  finalized: { label: 'Finalizado', client: 'Finalizado', chip: 'bg-ink text-white border-ink' },
};
export const IDENTITY_STATUSES = Object.keys(IDENTITY_STATUS_META) as IdentityStatus[];

// ─── Linhas do banco ───────────────────────────────────────────────────────
export interface IdentityProject {
  id: string;
  client_id: string;
  name: string;
  description: string;
  start_date: string | null;
  internal_notes: string;
  status: IdentityStatus;
  review_token: string;
  token_active: boolean;
  token_rotated_at: string;
  created_at: string;
  updated_at: string;
}

export interface IdentityStage {
  id: string;
  project_id: string;
  stage_key: StageKey;
  enabled: boolean;
  status: StageStatus;
  current_version: number;
  approved_at: string | null;
  approved_by: string | null;
  sent_at: string | null;
  updated_at: string;
}

// Conteúdo textual de cada etapa (guardado em identity_versions.content)
export const CONCEPT_FIELDS = [
  ['history', 'História'],
  ['purpose', 'Propósito'],
  ['positioning', 'Posicionamento'],
  ['creative_concept', 'Conceito criativo'],
  ['personality', 'Personalidade'],
  ['values', 'Valores'],
  ['tone_of_voice', 'Tom de voz'],
  ['keywords', 'Palavras-chave'],
  ['audience', 'Público'],
  ['manifesto', 'Manifesto'],
  ['description', 'Descrição geral'],
] as const;
export type ConceptField = (typeof CONCEPT_FIELDS)[number][0];

export interface ColorItem {
  id: string;
  name: string;
  hex: string;
  /** vazio = calculado automaticamente a partir do HEX; preenchido = edição manual */
  cmyk: string;
  pantone: string;
}
export interface Palette {
  id: string;
  label: string; // Paleta 01, Paleta 02…
  description: string;
  colors: ColorItem[];
}

export type FontRole = 'main' | 'secondary' | 'support';
export const FONT_ROLES: [FontRole, string][] = [
  ['main', 'Fonte principal'],
  ['secondary', 'Fonte secundária'],
  ['support', 'Fonte de apoio'],
];
export const FONT_CATEGORIES = ['Serifada', 'Sem serifa', 'Display', 'Manuscrita', 'Monoespaçada'];
export interface FontItem {
  id: string;
  role: FontRole;
  name: string;
  category: string;
  /** link de referência (ex.: Google Fonts) — o arquivo da fonte pode ser enviado à parte */
  reference: string;
  usage: string;
  sample: string;
}

export type StageContent = {
  title?: string;
  description?: string;
  message?: string;
  palettes?: Palette[];
  fonts?: FontItem[];
  /** formato antigo (lista simples) — convertido para Paleta 01 ao abrir */
  colors?: { id: string; name: string; hex: string; role?: string }[];
} & Partial<Record<ConceptField, string>>;

export interface IdentityVersion {
  id: string;
  stage_id: string;
  version_number: number;
  content: StageContent;
  note: string;
  created_at: string;
}

export const LOGO_SLOTS = [
  ['primary', 'Logo principal'],
  ['secondary', 'Logo secundário'],
  ['symbol', 'Símbolo'],
  ['horizontal', 'Versão horizontal'],
  ['vertical', 'Versão vertical'],
  ['light', 'Versão clara'],
  ['dark', 'Versão escura'],
  ['mono', 'Versão monocromática'],
  ['avatar', 'Avatar'],
] as const;
export type LogoSlot = (typeof LOGO_SLOTS)[number][0];

export const ELEMENT_CATEGORIES = ['Símbolos', 'Ícones', 'Patterns', 'Ilustrações', 'Grafismos', 'Texturas', 'Molduras', 'Elementos decorativos', 'Fotografias de referência'];
export const APPLICATION_CATEGORIES = ['Cartão de visita', 'Papelaria', 'Sacola', 'Uniforme', 'Embalagem', 'Fachada', 'Placa', 'Instagram', 'Site', 'Assinatura de e-mail', 'Pasta', 'Tag', 'Adesivo', 'Outros'];
export const FILE_CATEGORIES: [string, string][] = [
  ['logos', 'Logos (PNG, SVG, PDF, JPG)'],
  ['paleta', 'Paleta'],
  ['tipografia', 'Tipografia'],
  ['papelaria', 'Papelaria'],
  ['manual', 'Manual da marca'],
  ['outros', 'Outros'],
];

export interface IdentityAsset {
  id: string;
  project_id: string;
  stage_id: string;
  version_id: string;
  proposal_id: string | null;
  logo_version_id: string | null;
  slot: string;
  name: string;
  description: string;
  category: string;
  released: boolean;
  caption: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  position: number;
  created_at: string;
}
export interface SignedAsset extends IdentityAsset {
  url: string;
}

export interface LogoVersionData {
  id: string;
  proposal_id: string;
  version_number: number;
  changes: string;
  internal_notes: string;
  created_at: string;
  assets: SignedAsset[];
}
export interface LogoProposal {
  id: string;
  stage_id: string;
  label: string;
  description: string;
  position: number;
  is_chosen: boolean;
  chosen_at: string | null;
}
export interface ProposalData extends LogoProposal {
  /** V1, V2, V3… em ordem crescente; a última é a versão atual */
  versions: LogoVersionData[];
}
export const latestLogoVersion = (p: ProposalData) => p.versions[p.versions.length - 1];

export interface VersionData extends IdentityVersion {
  /** arquivos da etapa (exceto variações de logo) */
  assets: SignedAsset[];
}

export type FavKind = 'logo' | 'palette' | 'color' | 'font' | 'application';
export interface IdentityFavorite {
  id: string;
  project_id: string;
  stage_id: string | null;
  kind: FavKind;
  ref_id: string;
  label: string;
  created_at: string;
}
export interface IdentitySelection {
  id: string;
  project_id: string;
  stage_id: string | null;
  kind: 'colors';
  payload: { colorIds?: string[] };
  client_name: string;
  created_at: string;
}
export interface IdentityAnnotation {
  id: string;
  project_id: string;
  stage_id: string;
  asset_id: string;
  x: number | null;
  y: number | null;
  number: number | null;
  message: string;
  author_type: 'admin' | 'client';
  author_name: string;
  created_at: string;
}

export interface IdentityComment {
  id: string;
  project_id: string;
  stage_id: string;
  version_id: string | null;
  author_type: 'admin' | 'client';
  author_name: string;
  message: string;
  is_change_request: boolean;
  created_at: string;
}
export interface ApprovalSnapshot {
  logo?: { proposalId: string; label: string; versionNumber: number };
  palette?: { id: string; label: string; colors: { name: string; hex: string }[] } | null;
  colors?: { name: string; hex: string }[];
  fonts?: { role: FontRole; name: string }[];
  stages?: { key: StageKey; label: string; status: StageStatus }[];
}
export interface IdentityApproval {
  id: string;
  stage_id: string;
  version_id: string | null;
  action: 'approved' | 'changes_requested';
  client_name: string;
  note: string | null;
  snapshot: ApprovalSnapshot | null;
  created_at: string;
}
export interface IdentityActivity {
  id: string;
  project_id: string;
  stage_id: string | null;
  actor_type: 'admin' | 'client' | 'system';
  actor_name: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface StageData extends IdentityStage {
  versions: VersionData[];
  /** só na etapa Logo: propostas (cada uma com suas versões) */
  proposals: ProposalData[];
  comments: IdentityComment[];
  approvals: IdentityApproval[];
}

export interface IdentityDetail {
  project: IdentityProject;
  stages: StageData[];
  activity: IdentityActivity[];
  favorites: IdentityFavorite[];
  selections: IdentitySelection[];
  annotations: IdentityAnnotation[];
  /** downloads por arquivo (id → quantidade) */
  downloads: Record<string, number>;
}

// ─── Progresso ─────────────────────────────────────────────────────────────
type StageLike = { stage_key: StageKey; enabled: boolean; status: StageStatus };

/** Etapas que contam para o progresso: ativas e com aprovação. */
export const countableStages = <T extends StageLike>(stages: T[]) =>
  stages.filter((s) => s.enabled && STAGE_BY_KEY[s.stage_key].approvable);

export function progressOf(stages: StageLike[]) {
  const list = countableStages(stages);
  const approved = list.filter((s) => s.status === 'approved').length;
  return { approved, total: list.length, pct: list.length ? Math.round((approved / list.length) * 100) : 0 };
}

/** Status do projeto a partir das etapas (finalizado é sempre manual). */
export function deriveProjectStatus(current: IdentityStatus, stages: StageLike[]): IdentityStatus {
  if (current === 'finalized') return 'finalized';
  const list = countableStages(stages);
  if (list.some((s) => s.status === 'changes_requested')) return 'changes_requested';
  if (list.some((s) => s.status === 'awaiting')) return 'awaiting_approval';
  if (list.length && list.every((s) => s.status === 'approved')) return 'approved';
  return 'in_creation';
}

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Etapa → subpasta no Storage (brands/<cliente>/<projeto>/…). */
export const STAGE_FOLDER: Record<StageKey, string> = {
  concept: 'concept',
  moodboard: 'moodboard',
  logo: 'logos',
  colors: 'colors',
  typography: 'typography',
  elements: 'elements',
  applications: 'mockups',
  final: 'final',
  files: 'final',
};

/** Mesmo formato de `CommentRow` do módulo de conteúdo (reutiliza o componente CommentThread). */
export interface CommentRowLike {
  id: string;
  content_id: string;
  version_id: string | null;
  author_type: 'admin' | 'client';
  author_name: string;
  message: string;
  slide_index: number | null;
  is_change_request: boolean;
  created_at: string;
}

/** Frases de status por etapa, com a concordância certa (ex.: "Cores aprovadas"). */
const GENDER: Record<StageKey, { f: boolean; pl: boolean }> = {
  concept: { f: false, pl: false },
  moodboard: { f: false, pl: false },
  logo: { f: false, pl: false },
  colors: { f: true, pl: true },
  typography: { f: true, pl: false },
  elements: { f: false, pl: true },
  applications: { f: true, pl: true },
  final: { f: true, pl: false },
  files: { f: false, pl: true },
};
export function stageSentence(key: StageKey, status: StageStatus): string {
  const g = GENDER[key];
  const label = STAGE_BY_KEY[key].label;
  const adj = (base: string) => `${base.slice(0, -1)}${g.f ? 'a' : 'o'}${g.pl ? 's' : ''}`; // aprovado → aprovada/aprovados…
  if (status === 'approved') return `${label} ${adj('aprovado')}`;
  if (status === 'awaiting') return `${label} aguardando`;
  if (status === 'changes_requested') return `${label}: alteração solicitada`;
  return `${label} ainda não enviad${g.f ? 'a' : 'o'}${g.pl ? 's' : ''}`;
}
