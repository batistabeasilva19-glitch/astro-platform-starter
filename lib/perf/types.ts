/**
 * DESEMPENHO & RELATÓRIOS — definições compartilhadas (tipos, métricas, rótulos).
 * Sem dependências de servidor: usado por formulários, cálculos, telas e PDF.
 */

export type MetricUnit = 'int' | 'pct' | 'min' | 'sec';
export interface MetricDef {
  key: string;
  label: string;
  unit: MetricUnit;
  hint?: string;
}

export const SOURCES = [
  { id: 'instagram_insights', label: 'Instagram Insights' },
  { id: 'meta_business_suite', label: 'Meta Business Suite' },
  { id: 'meta_ads', label: 'Meta Ads' },
  { id: 'google_analytics', label: 'Google Analytics' },
  { id: 'manual', label: 'Relatório manual' },
  { id: 'other', label: 'Outro' },
] as const;
export type SourceId = (typeof SOURCES)[number]['id'];
export const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));
export const isSource = (v: unknown): v is SourceId => SOURCES.some((s) => s.id === v);

// ─── Perfil ───────────────────────────────────────────────────────────
/** Campos numéricos do perfil, na ordem em que aparecem no formulário. */
export const PROFILE_FIELDS: { group: string; fields: MetricDef[] }[] = [
  {
    group: 'Seguidores',
    fields: [
      { key: 'followers_start', label: 'Seguidores no início', unit: 'int' },
      { key: 'followers_end', label: 'Seguidores no final', unit: 'int' },
      { key: 'new_followers', label: 'Novos seguidores', unit: 'int' },
      { key: 'lost_followers', label: 'Seguidores perdidos', unit: 'int' },
    ],
  },
  {
    group: 'Alcance e visibilidade',
    fields: [
      { key: 'reach', label: 'Contas alcançadas', unit: 'int' },
      { key: 'impressions', label: 'Impressões', unit: 'int' },
      { key: 'views', label: 'Visualizações', unit: 'int' },
    ],
  },
  {
    group: 'Ações no perfil',
    fields: [
      { key: 'profile_visits', label: 'Visitas ao perfil', unit: 'int' },
      { key: 'link_clicks', label: 'Cliques no link da bio', unit: 'int' },
      { key: 'contact_clicks', label: 'Cliques em botões de contato', unit: 'int' },
      { key: 'messages', label: 'Mensagens recebidas', unit: 'int' },
    ],
  },
  {
    group: 'Interações',
    fields: [
      { key: 'interactions', label: 'Interações totais', unit: 'int', hint: 'Deixe vazio para somar curtidas + comentários + compartilhamentos + salvamentos + respostas.' },
      { key: 'likes', label: 'Curtidas', unit: 'int' },
      { key: 'comments', label: 'Comentários', unit: 'int' },
      { key: 'shares', label: 'Compartilhamentos', unit: 'int' },
      { key: 'saves', label: 'Salvamentos', unit: 'int' },
      { key: 'replies', label: 'Respostas', unit: 'int' },
      { key: 'sticker_taps', label: 'Toques em stickers (quando aplicável)', unit: 'int' },
    ],
  },
];
export const PROFILE_KEYS = PROFILE_FIELDS.flatMap((g) => g.fields.map((f) => f.key));

export interface ProfileRow {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  source: string;
  source_note: string;
  notes: string;
  followers_start: number | null;
  followers_end: number | null;
  new_followers: number | null;
  lost_followers: number | null;
  reach: number | null;
  impressions: number | null;
  views: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  contact_clicks: number | null;
  messages: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  replies: number | null;
  sticker_taps: number | null;
}

// ─── Conteúdos ────────────────────────────────────────────────────────
export type FormatGroup = 'post' | 'carousel' | 'reel' | 'story';
export const FORMAT_GROUPS: { id: FormatGroup; label: string; plural: string }[] = [
  { id: 'post', label: 'Post', plural: 'Posts' },
  { id: 'carousel', label: 'Carrossel', plural: 'Carrosséis' },
  { id: 'reel', label: 'Reel', plural: 'Reels' },
  { id: 'story', label: 'Story', plural: 'Stories' },
];
/** O formato "vídeo" do sistema entra junto com os Reels nas comparações. */
export const toFormatGroup = (f: string): FormatGroup => (f === 'video' ? 'reel' : f === 'carousel' || f === 'reel' || f === 'story' ? f : 'post');

const COMMON: MetricDef[] = [
  { key: 'reach', label: 'Alcance', unit: 'int' },
  { key: 'impressions', label: 'Impressões', unit: 'int' },
  { key: 'likes', label: 'Curtidas', unit: 'int' },
  { key: 'comments', label: 'Comentários', unit: 'int' },
  { key: 'shares', label: 'Compartilhamentos', unit: 'int' },
  { key: 'saves', label: 'Salvamentos', unit: 'int' },
  { key: 'profile_visits', label: 'Visitas ao perfil', unit: 'int' },
  { key: 'new_followers', label: 'Novos seguidores atribuídos', unit: 'int' },
  { key: 'clicks', label: 'Cliques', unit: 'int' },
  { key: 'leads', label: 'Leads', unit: 'int' },
  { key: 'conversions', label: 'Conversões', unit: 'int' },
  { key: 'interactions', label: 'Interações totais', unit: 'int', hint: 'Vazio = soma curtidas, comentários, compartilhamentos e salvamentos.' },
  { key: 'engagement_rate', label: 'Taxa de engajamento (%)', unit: 'pct', hint: 'Vazio = interações ÷ alcance × 100.' },
];

export const CONTENT_FIELDS: Record<FormatGroup, MetricDef[]> = {
  post: COMMON,
  carousel: [...COMMON, { key: 'slide_views', label: 'Visualizações dos slides', unit: 'int', hint: 'Se estiver disponível.' }],
  reel: [
    { key: 'views', label: 'Visualizações', unit: 'int' },
    { key: 'plays', label: 'Reproduções', unit: 'int' },
    { key: 'total_watch_min', label: 'Tempo total assistido (minutos)', unit: 'min' },
    { key: 'avg_watch_sec', label: 'Tempo médio assistido (segundos)', unit: 'sec' },
    { key: 'retention', label: 'Retenção (%)', unit: 'pct' },
    ...COMMON,
  ],
  story: [
    { key: 'views', label: 'Visualizações', unit: 'int' },
    { key: 'reach', label: 'Alcance', unit: 'int' },
    { key: 'impressions', label: 'Impressões', unit: 'int' },
    { key: 'replies', label: 'Respostas', unit: 'int' },
    { key: 'shares', label: 'Compartilhamentos', unit: 'int' },
    { key: 'link_clicks', label: 'Cliques em link', unit: 'int' },
    { key: 'sticker_taps', label: 'Toques em sticker', unit: 'int' },
    { key: 'taps_forward', label: 'Avançar', unit: 'int' },
    { key: 'taps_back', label: 'Voltar', unit: 'int' },
    { key: 'next_story', label: 'Próximo Story', unit: 'int' },
    { key: 'exits', label: 'Saídas', unit: 'int' },
    { key: 'completion_rate', label: 'Taxa de conclusão (%)', unit: 'pct' },
    { key: 'new_followers', label: 'Novos seguidores atribuídos', unit: 'int' },
    { key: 'leads', label: 'Leads', unit: 'int' },
    { key: 'conversions', label: 'Conversões', unit: 'int' },
  ],
};
export const CONTENT_METRIC_KEYS = Array.from(new Set(Object.values(CONTENT_FIELDS).flat().map((m) => m.key)));
export const CONTENT_METRIC_DEF: Record<string, MetricDef> = Object.fromEntries(Object.values(CONTENT_FIELDS).flat().map((m) => [m.key, m]));

export const SNAPSHOT_LABELS = [
  { id: '24h', label: '24 horas' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Outra data' },
] as const;
export type SnapshotLabel = (typeof SNAPSHOT_LABELS)[number]['id'];
export const SNAPSHOT_LABEL_TEXT: Record<string, string> = Object.fromEntries(SNAPSHOT_LABELS.map((s) => [s.id, s.label]));

export interface SnapshotRow {
  id: string;
  content_id: string;
  client_id: string;
  collected_on: string;
  label: SnapshotLabel;
  metrics: Record<string, number>;
  source: string;
  source_note: string;
  notes: string;
  is_final: boolean;
  created_at: string;
}

export const TAG_SUGGESTIONS = ['Educacional', 'Autoridade', 'Venda', 'Prova social', 'Bastidores', 'Entretenimento', 'Institucional', 'Relacionamento', 'Conversão'];
export const OBJECTIVES = ['Alcance', 'Reconhecimento', 'Engajamento', 'Relacionamento', 'Autoridade', 'Tráfego', 'Leads', 'Conversão', 'Venda'] as const;
/** Métrica que melhor mede cada objetivo (usada na análise por objetivo). */
export const OBJECTIVE_METRIC: Record<string, { key: string; label: string }> = {
  Alcance: { key: 'reach', label: 'alcance médio' },
  Reconhecimento: { key: 'impressions', label: 'impressões médias' },
  Engajamento: { key: 'engagement_rate', label: 'engajamento médio' },
  Relacionamento: { key: 'comments', label: 'comentários médios' },
  Autoridade: { key: 'saves', label: 'salvamentos médios' },
  Tráfego: { key: 'clicks', label: 'cliques médios' },
  Leads: { key: 'leads', label: 'leads médios' },
  Conversão: { key: 'conversions', label: 'conversões médias' },
  Venda: { key: 'conversions', label: 'conversões médias' },
};

export interface ContentLite {
  id: string;
  title: string;
  format: string;
  status: string;
  scheduled_date: string | null;
  thumb: string | null;
}
export interface MetaRow {
  content_id: string;
  tags: string[];
  objectives: string[];
}

// ─── Tráfego pago ─────────────────────────────────────────────────────
export const PAID_FIELDS: MetricDef[] = [
  { key: 'investment', label: 'Investimento (R$)', unit: 'int' },
  { key: 'impressions', label: 'Impressões', unit: 'int' },
  { key: 'reach', label: 'Alcance', unit: 'int' },
  { key: 'frequency', label: 'Frequência', unit: 'int', hint: 'Ex.: 1,8 (aceita decimais).' },
  { key: 'clicks', label: 'Cliques', unit: 'int' },
  { key: 'link_clicks', label: 'Cliques no link', unit: 'int' },
  { key: 'views', label: 'Visualizações', unit: 'int' },
  { key: 'leads', label: 'Leads', unit: 'int' },
  { key: 'conversions', label: 'Conversões', unit: 'int' },
  { key: 'purchases', label: 'Compras', unit: 'int' },
  { key: 'messages', label: 'Mensagens iniciadas', unit: 'int' },
  { key: 'revenue', label: 'Receita (R$)', unit: 'int' },
];
export const PAID_KEYS = PAID_FIELDS.map((f) => f.key);
export const PAID_DECIMAL = new Set(['investment', 'revenue', 'frequency']);

export const PLATFORMS = [
  { id: 'meta', label: 'Meta Ads' },
  { id: 'google', label: 'Google Ads' },
  { id: 'other', label: 'Outra' },
] as const;
export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label]));
export const CAMPAIGN_STATUS = [
  { id: 'planned', label: 'Planejada' },
  { id: 'active', label: 'Ativa' },
  { id: 'paused', label: 'Pausada' },
  { id: 'finished', label: 'Encerrada' },
] as const;
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = Object.fromEntries(CAMPAIGN_STATUS.map((s) => [s.id, s.label]));

export interface CampaignRow {
  id: string;
  client_id: string;
  name: string;
  platform: string;
  objective: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  spent: number | null;
  status: string;
  notes: string;
}
export interface CampaignMetricRow {
  id: string;
  campaign_id: string;
  month: string;
  metrics: Record<string, number>;
  source: string;
  notes: string;
}
export interface CampaignContentRow {
  campaign_id: string;
  content_id: string;
}
export interface MonthConfigRow {
  month: string;
  uses_paid: boolean;
}

// ─── Relatório ────────────────────────────────────────────────────────
export const REPORT_STATUS = [
  { id: 'draft', label: 'Rascunho' },
  { id: 'in_review', label: 'Em análise' },
  { id: 'ready', label: 'Pronto para revisão' },
  { id: 'final', label: 'Finalizado' },
  { id: 'sent', label: 'Enviado ao cliente' },
] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number]['id'];
export const REPORT_STATUS_LABEL: Record<string, string> = Object.fromEntries(REPORT_STATUS.map((s) => [s.id, s.label]));

export interface Insight {
  id: string;
  /** chave estável da análise automática (vazia = escrita pela administradora) */
  key: string;
  text: string;
  enabled: boolean;
  edited: boolean;
}

export interface ReportEdits {
  /** textos livres: resumo, resultados, o que funcionou… */
  texts: Record<string, string>;
  /** análise curta de cada seção do relatório */
  analyses: Record<string, string>;
  /** títulos personalizados das seções */
  titles: Record<string, string>;
  insights: Insight[];
  /** observações internas — NUNCA vão para o cliente nem para o PDF */
  internal_notes: string;
}
export const EMPTY_EDITS: ReportEdits = { texts: {}, analyses: {}, titles: {}, insights: [], internal_notes: '' };

export const REPORT_TEXT_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: 'summary', label: 'Resumo do mês' },
  { key: 'results', label: 'Principais resultados' },
  { key: 'worked', label: 'O que funcionou' },
  { key: 'improve', label: 'O que pode melhorar' },
  { key: 'learnings', label: 'Aprendizados' },
  { key: 'recommendations', label: 'Recomendações' },
  { key: 'next_steps', label: 'Próximos passos' },
  { key: 'next_goals', label: 'Objetivos do próximo mês' },
  { key: 'next_tests', label: 'Testes para o próximo mês' },
  { key: 'next_pillars', label: 'Pilares prioritários' },
  { key: 'next_formats', label: 'Formatos para o próximo mês' },
];

/** Seções do relatório (ordem do PDF). `analysis` = tem campo de análise editável. */
export const REPORT_SECTIONS: { id: string; number: string; title: string; analysis?: boolean; paidOnly?: boolean }[] = [
  { id: 'overview', number: '01', title: 'Visão geral' },
  { id: 'growth', number: '02', title: 'Crescimento', analysis: true },
  { id: 'reach', number: '03', title: 'Alcance & visibilidade', analysis: true },
  { id: 'engagement', number: '04', title: 'Engajamento', analysis: true },
  { id: 'published', number: '05', title: 'Conteúdos publicados' },
  { id: 'highlights', number: '06', title: 'Destaques do mês', analysis: true },
  { id: 'formats', number: '07', title: 'Análise por formato', analysis: true },
  { id: 'pillars', number: '08', title: 'Análise por pilar', analysis: true },
  { id: 'paid', number: '09', title: 'Tráfego pago', analysis: true, paidOnly: true },
  { id: 'organic_paid', number: '10', title: 'Orgânico x pago', paidOnly: true },
  { id: 'learnings', number: '11', title: 'Principais aprendizados' },
  { id: 'recommendations', number: '12', title: 'Recomendações' },
  { id: 'next', number: '13', title: 'Próximo mês' },
];

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
