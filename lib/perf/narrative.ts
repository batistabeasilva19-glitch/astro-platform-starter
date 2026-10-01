/**
 * Textos automáticos do relatório e "pacote para IA" — tudo puro, só com dados cadastrados.
 * Regra de ouro: não inventa número. Sem dado → não escreve a frase.
 */
import { delta, fmtDec, fmtInt, fmtMoney, fmtPct, fmtRatio, fmtSigned, fmtSignedPct, type ContentResult } from './calc';
import type { ReportData } from './report';
import { FORMAT_GROUPS, REPORT_SECTIONS, REPORT_TEXT_FIELDS, type ReportEdits } from './types';

const plural = (g: { group: string; plural: string }) => (g.group === 'reel' ? 'Reels' : g.group === 'story' ? 'Stories' : g.plural.toLowerCase());
const lines = (l: (string | null | false | undefined)[]) => l.filter(Boolean).map((x) => `- ${x}`).join('\n');
const pctWord = (p: number | null | undefined) => (p == null ? null : `${p >= 0 ? 'alta' : 'queda'} de ${fmtDec(Math.abs(p)).replace(/,0$/, '')}%`);

export interface AutoTexts {
  texts: Record<string, string>;
  analyses: Record<string, string>;
}

export function autoTexts(d: ReportData): AutoTexts {
  const { cur, prev } = d.profile;
  const texts: Record<string, string> = {};
  const analyses: Record<string, string> = {};
  const dReach = delta(cur.reach, prev.reach);
  const dInter = delta(cur.interactions, prev.interactions);
  const dImp = delta(cur.impressions, prev.impressions);
  const dVisits = delta(cur.visits, prev.visits);
  const bestFormat = [...d.formats].filter((f) => f.reach).sort((a, b) => b.reach! - a.reach!)[0];
  const worstFormat = [...d.formats].filter((f) => f.reach).sort((a, b) => a.reach! - b.reach!)[0];
  const pillarsBy = (k: 'saves' | 'er' | 'reach' | 'clicks') => [...d.pillars].filter((p) => (p[k] ?? 0) > 0).sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0));
  const topReach = d.rankings.find((r) => r.def.id === 'reach')?.entries[0];
  const pub = d.published;
  const pubParts = FORMAT_GROUPS.filter((g) => pub.byFormat[g.id] > 0).map((g) => `${pub.byFormat[g.id]} ${pub.byFormat[g.id] === 1 ? g.label.toLowerCase() : g.plural.toLowerCase()}`);
  const t = d.paid?.totals;

  // resumo
  const sum: string[] = [];
  if (cur.followersEnd != null) sum.push(`Em ${d.label}, o perfil${d.client.handle ? ` @${d.client.handle.replace(/^@/, '')}` : ''} terminou o mês com ${fmtInt(cur.followersEnd)} seguidores${cur.net != null ? ` (${cur.net >= 0 ? '+' : '−'}${fmtInt(Math.abs(cur.net))} no período${cur.growthPct != null ? `, ${fmtSignedPct(cur.growthPct)}` : ''})` : ''}.`);
  else if (d.hasData) sum.push(`Resumo de ${d.label}.`);
  if (cur.reach != null) sum.push(`O alcance foi de ${fmtInt(cur.reach)} contas${dReach.pct != null ? `, uma ${pctWord(dReach.pct)} em relação a ${d.prevRange.label}` : ''}.`);
  if (cur.interactions != null) sum.push(`As interações somaram ${fmtInt(cur.interactions)}${cur.erReach != null ? ` (engajamento de ${fmtPct(cur.erReach)} sobre o alcance)` : ''}.`);
  if (pub.total > 0) sum.push(`Foram ${pub.total} conteúdos no mês: ${pubParts.join(', ')}.`);
  if (sum.length) texts.summary = sum.join(' ');

  // principais resultados
  const res = lines([
    cur.net != null && `Seguidores: ${fmtSigned(cur.net)} líquidos (${fmtInt(cur.newFollowers)} novos, ${fmtInt(cur.lostFollowers)} perdidos).`,
    cur.reach != null && `Alcance: ${fmtInt(cur.reach)}${dReach.pct != null ? ` (${fmtSignedPct(dReach.pct)} vs ${d.prevRange.label})` : ''}.`,
    cur.impressions != null && `Impressões: ${fmtInt(cur.impressions)}${dImp.pct != null ? ` (${fmtSignedPct(dImp.pct)})` : ''}.`,
    cur.interactions != null && `Interações: ${fmtInt(cur.interactions)}${dInter.pct != null ? ` (${fmtSignedPct(dInter.pct)})` : ''}.`,
    cur.visits != null && `Visitas ao perfil: ${fmtInt(cur.visits)}${dVisits.pct != null ? ` (${fmtSignedPct(dVisits.pct)})` : ''}.`,
    cur.linkClicks != null && `Cliques no link da bio: ${fmtInt(cur.linkClicks)}.`,
    t?.investment != null && `Tráfego pago: ${fmtMoney(t.investment)} investidos${t.leads ? `, ${fmtInt(t.leads)} leads` : ''}${t.conversions ? `, ${fmtInt(t.conversions)} conversões` : ''}${t.roas != null ? `, ROAS ${fmtRatio(t.roas)}` : ''}.`,
    topReach && `Maior alcance: “${topReach.title}” (${fmtInt(topReach.value)} pessoas).`,
  ]);
  if (res) texts.results = res;

  // o que funcionou
  const worked = lines([
    topReach && `“${topReach.title}” foi o conteúdo de maior alcance (${fmtInt(topReach.value)}).`,
    bestFormat && d.formats.length > 1 && `${bestFormat.plural} tiveram o maior alcance médio (${fmtInt(bestFormat.reach)}).`,
    pillarsBy('saves')[0] && d.pillars.length > 1 && `O pilar ${pillarsBy('saves')[0].tag} teve o maior número médio de salvamentos (${fmtDec(pillarsBy('saves')[0].saves)}).`,
    pillarsBy('er')[0] && d.pillars.length > 1 && `O pilar ${pillarsBy('er')[0].tag} teve o maior engajamento médio (${fmtPct(pillarsBy('er')[0].er)}).`,
    ...d.autoInsights.filter((i) => i.key.startsWith('delta_') && /cresce/.test(i.text)).map((i) => i.text),
  ]);
  if (worked) texts.worked = worked;

  // o que pode melhorar
  const improve = lines([
    ...d.autoInsights.filter((i) => i.key.startsWith('delta_') && /ca[íi]|caiu/.test(i.text)).map((i) => i.text),
    worstFormat && bestFormat && worstFormat.group !== bestFormat.group && (bestFormat.reach! - worstFormat.reach!) / worstFormat.reach! >= 0.3 && `${worstFormat.plural} tiveram o menor alcance médio (${fmtInt(worstFormat.reach)}), bem abaixo de ${bestFormat.plural} (${fmtInt(bestFormat.reach)}).`,
    cur.net != null && cur.net < 0 && `O perfil perdeu seguidores no período (${fmtSigned(cur.net)}).`,
    t?.roas != null && t.roas < 1 && `O ROAS ficou abaixo de 1 (${fmtRatio(t.roas)}): a receita não cobriu o investimento.`,
  ]);
  if (improve) texts.improve = improve;

  // aprendizados
  const bestBy = (k: 'shares' | 'saves' | 'clicks') => [...d.formats].filter((f) => (f[k] ?? 0) > 0).sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0))[0];
  const learn = lines([
    bestBy('shares') && d.formats.length > 1 && `${bestBy('shares')!.plural} geram mais compartilhamentos (média de ${fmtDec(bestBy('shares')!.shares)}).`,
    bestBy('saves') && d.formats.length > 1 && `${bestBy('saves')!.plural} geram mais salvamentos (média de ${fmtDec(bestBy('saves')!.saves)}).`,
    bestBy('clicks') && d.formats.length > 1 && `${bestBy('clicks')!.plural} geram mais cliques (média de ${fmtDec(bestBy('clicks')!.clicks)}).`,
    ...d.objectives.filter((o) => o.best).slice(0, 3).map((o) => `Para o objetivo ${o.objective}, o melhor conteúdo foi “${o.best!.title}”.`),
    t?.cpl != null && `O custo por lead foi de ${fmtMoney(t.cpl)}.`,
  ]);
  if (learn) texts.learnings = learn;

  // recomendações (sugestões baseadas nos dados)
  const rec = lines([
    bestFormat && d.formats.length > 1 && `Priorizar ${plural(bestFormat)}, que lideram em alcance médio.`,
    pillarsBy('saves')[0] && d.pillars.length > 1 && `Manter e ampliar o pilar ${pillarsBy('saves')[0].tag}, o que mais gera salvamentos.`,
    pillarsBy('reach').length > 1 && pillarsBy('reach')[pillarsBy('reach').length - 1].tag !== pillarsBy('saves')[0]?.tag && `Rever a abordagem do pilar ${pillarsBy('reach')[pillarsBy('reach').length - 1].tag}, o de menor alcance médio.`,
    t?.roas != null && t.roas >= 1 && `Manter o investimento nas campanhas com melhor retorno (ROAS ${fmtRatio(t.roas)}).`,
    cur.erReach != null && `Acompanhar o engajamento por alcance (${fmtPct(cur.erReach)}) como referência para o próximo mês.`,
  ]);
  if (rec) texts.recommendations = rec;

  // próximo mês
  const goals = lines([
    cur.followersEnd != null && cur.net != null && cur.net > 0 && `Chegar a cerca de ${fmtInt(cur.followersEnd + cur.net)} seguidores mantendo o ritmo atual (${fmtSigned(cur.net)}).`,
    cur.reach != null && `Superar o alcance deste mês (${fmtInt(cur.reach)}).`,
    cur.erReach != null && `Manter o engajamento por alcance em pelo menos ${fmtPct(cur.erReach)}.`,
  ]);
  if (goals) texts.next_goals = goals;
  const missing = FORMAT_GROUPS.filter((g) => pub.byFormat[g.id] === 0 && pub.total > 0);
  const tests = lines([
    ...missing.map((g) => `Testar ${plural({ group: g.id, plural: g.plural })} (nenhum publicado neste mês).`),
    worstFormat && bestFormat && worstFormat.group !== bestFormat.group && `Testar novos ângulos de ${plural(worstFormat)} para aproximar o alcance de ${plural(bestFormat)}.`,
  ]);
  if (tests) texts.next_tests = tests;
  const topP = pillarsBy('er').slice(0, 2).map((p) => p.tag);
  if (topP.length) texts.next_pillars = topP.join(' e ');
  const fm = [...d.formats].filter((f) => f.reach).sort((a, b) => b.reach! - a.reach!);
  if (fm.length) texts.next_formats = fm.map((f) => `${f.plural} (alcance médio ${fmtInt(f.reach)})`).join(', ');
  const steps = lines([
    pub.total > 0 && `Manter a frequência de cerca de ${pub.total} conteúdos por mês.`,
    d.paid && `Decidir a continuidade das campanhas de tráfego pago com base no custo por resultado.`,
    d.contents.some((c) => c.status === 'published' && !c.collected) && `Cadastrar os resultados das publicações que ainda estão sem coleta.`,
  ]);
  if (steps) texts.next_steps = steps;

  // análises por seção
  if (d.profile.series.followers.length || cur.net != null) analyses.growth = [cur.net != null && `O perfil ${cur.net >= 0 ? 'ganhou' : 'perdeu'} ${fmtInt(Math.abs(cur.net))} seguidores líquidos${cur.growthPct != null ? ` (${fmtSignedPct(cur.growthPct)})` : ''}, com ${fmtInt(cur.newFollowers)} novos e ${fmtInt(cur.lostFollowers)} perdidos.`, prev.followersEnd != null && cur.followersEnd != null && `Em ${d.prevRange.label} eram ${fmtInt(prev.followersEnd)} seguidores no fim do período.`].filter(Boolean).join(' ');
  if (cur.reach != null || cur.impressions != null) analyses.reach = [cur.reach != null && `O alcance foi de ${fmtInt(cur.reach)}${dReach.pct != null ? ` (${fmtSignedPct(dReach.pct)} vs ${d.prevRange.label})` : ''}.`, cur.impressions != null && `As impressões somaram ${fmtInt(cur.impressions)}${dImp.pct != null ? ` (${fmtSignedPct(dImp.pct)})` : ''}.`].filter(Boolean).join(' ');
  if (cur.interactions != null) analyses.engagement = [`Foram ${fmtInt(cur.interactions)} interações${dInter.pct != null ? ` (${fmtSignedPct(dInter.pct)} vs ${d.prevRange.label})` : ''}.`, cur.erReach != null && `A taxa de engajamento sobre o alcance foi de ${fmtPct(cur.erReach)}${cur.erFollowers != null ? ` e, sobre os seguidores, de ${fmtPct(cur.erFollowers)}` : ''}.`, cur.saves != null && cur.shares != null && `Foram ${fmtInt(cur.saves)} salvamentos e ${fmtInt(cur.shares)} compartilhamentos.`].filter(Boolean).join(' ');
  if (d.rankings.length) analyses.highlights = d.rankings.slice(0, 4).map((r) => `${r.def.title}: “${r.entries[0].title}” (${r.def.unit === 'pct' ? fmtPct(r.entries[0].value) : fmtInt(r.entries[0].value)} ${r.def.unitLabel}).`).join(' ');
  if (d.formats.length) analyses.formats = d.formats.map((f) => `${f.plural}: alcance médio ${fmtInt(f.reach)}${f.er != null ? `, engajamento ${fmtPct(f.er)}` : ''} (${f.count} ${f.count === 1 ? 'conteúdo' : 'conteúdos'}).`).join(' ');
  if (d.pillars.length) analyses.pillars = d.pillars.slice(0, 5).map((p) => `${p.tag}: ${p.count} ${p.count === 1 ? 'conteúdo' : 'conteúdos'}, alcance médio ${fmtInt(p.reach)}${p.er != null ? `, engajamento ${fmtPct(p.er)}` : ''}.`).join(' ');
  if (t && t.investment != null) analyses.paid = [`Foram investidos ${fmtMoney(t.investment)}${t.impressions ? ` para ${fmtInt(t.impressions)} impressões` : ''}${t.clicks ? ` e ${fmtInt(t.clicks)} cliques (CTR ${fmtPct(t.ctr)}, CPC ${fmtMoney(t.cpc)})` : ''}.`, t.leads ? `Os anúncios geraram ${fmtInt(t.leads)} leads (CPL ${fmtMoney(t.cpl)}).` : '', t.conversions ? `Foram ${fmtInt(t.conversions)} conversões (CPA ${fmtMoney(t.cpa)}).` : '', t.roas != null ? `ROAS de ${fmtRatio(t.roas)}.` : ''].filter(Boolean).join(' ');
  return { texts, analyses };
}

// ─── pacote para colar na IA ────────────────────────────────────────────────
/** Rótulos dos campos que a IA deve devolver (também usados para ler a resposta). */
export const AI_FIELDS: { id: string; group: 'texts' | 'analyses'; key: string; label: string }[] = [
  ...REPORT_TEXT_FIELDS.map((f) => ({ id: `texts:${f.key}`, group: 'texts' as const, key: f.key, label: f.label })),
  ...REPORT_SECTIONS.filter((s) => s.analysis).map((s) => ({ id: `analyses:${s.id}`, group: 'analyses' as const, key: s.id, label: `Análise — ${s.title}` })),
];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Lê a resposta da IA: blocos que começam com "### Nome do campo". Campos desconhecidos são ignorados. */
export function parseAiResponse(raw: string): AutoTexts & { found: number } {
  const out: AutoTexts = { texts: {}, analyses: {} };
  const parts = raw.split(/^#{2,4}\s*/m).slice(1);
  let found = 0;
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const head = norm(nl < 0 ? part : part.slice(0, nl));
    const body = (nl < 0 ? '' : part.slice(nl + 1)).trim();
    const f = AI_FIELDS.find((x) => norm(x.label) === head) ?? AI_FIELDS.find((x) => head.startsWith(norm(x.label)));
    if (f && body) {
      out[f.group][f.key] = body;
      found++;
    }
  }
  return { ...out, found };
}

const row = (cells: (string | number | null | undefined)[]) => `| ${cells.map((c) => (c == null || c === '' ? '–' : String(c).replace(/\|/g, '/'))).join(' | ')} |`;
const metricLine = (c: ContentResult) =>
  Object.entries(c.metrics)
    .map(([k, v]) => `${k}=${Math.round(v * 100) / 100}`)
    .join(', ') || 'sem resultado cadastrado';

/** Texto completo (pedido + todos os dados do mês) para colar em qualquer IA. Nunca inclui observações internas. */
export function aiBrief(d: ReportData, edits: ReportEdits): string {
  const { cur, prev, series } = d.profile;
  const kv = (label: string, a: number | null, b: number | null, f: (n: number | null) => string = fmtInt) => `- ${label}: ${f(a)} (anterior: ${f(b)}${delta(a, b).pct != null ? `, variação ${fmtSignedPct(delta(a, b).pct)}` : ''})`;
  const s: string[] = [];
  s.push(`# PEDIDO
Você é analista de social media e vai escrever os textos de um relatório mensal de desempenho do Instagram da cliente "${d.client.name}" (${d.label}), para a agência Soltria.

Regras:
- Escreva em português do Brasil, tom profissional, claro e acolhedor, em primeira pessoa do plural ("nós"). Frases curtas.
- Use SOMENTE os dados da seção "DADOS" abaixo. Não invente números, causas ou fatos. Se um dado aparece como "–", não comente.
- Quando comparar, cite o período anterior (${d.prevRange.label}).
- Recomendações e objetivos devem decorrer dos dados (ex.: formato com maior alcance, pilar com mais salvamentos).
- Texto para o cliente final ler: sem jargão técnico excessivo e sem mencionar custos internos da agência.

FORMATO DA RESPOSTA — responda com um bloco por campo, cada um começando com a linha "### " e o nome EXATO do campo, seguido do texto (pode usar listas com "- "). Não escreva nada fora desses blocos. Se não houver dado suficiente para um campo, escreva apenas "### Nome do campo" sem texto abaixo.

Campos:
${AI_FIELDS.map((f) => `### ${f.label}`).join('\n')}
`);
  s.push(`# DADOS

## Cliente e período
- Cliente: ${d.client.name}${d.client.handle ? ` (@${d.client.handle.replace(/^@/, '')})` : ''}
- Mês do relatório: ${d.label} (${d.range.from} a ${d.range.to})
- Comparação com: ${d.prevRange.label}

## Perfil — indicadores do mês
${[
  kv('Seguidores no final', cur.followersEnd, prev.followersEnd),
  `- Seguidores no início: ${fmtInt(cur.followersStart)}`,
  `- Novos seguidores: ${fmtInt(cur.newFollowers)} | Perdidos: ${fmtInt(cur.lostFollowers)}`,
  `- Crescimento líquido: ${fmtSigned(cur.net)} | Taxa de crescimento: ${fmtPct(cur.growthPct)} (líquido ÷ seguidores iniciais × 100)`,
  kv('Alcance (contas)', cur.reach, prev.reach),
  kv('Impressões', cur.impressions, prev.impressions),
  kv('Visualizações', cur.views, prev.views),
  kv('Visitas ao perfil', cur.visits, prev.visits),
  kv('Cliques no link da bio', cur.linkClicks, prev.linkClicks),
  kv('Cliques em botões de contato', cur.contactClicks, prev.contactClicks),
  kv('Mensagens recebidas', cur.messages, prev.messages),
  kv('Interações totais', cur.interactions, prev.interactions),
  kv('Curtidas', cur.likes, prev.likes),
  kv('Comentários', cur.comments, prev.comments),
  kv('Compartilhamentos', cur.shares, prev.shares),
  kv('Salvamentos', cur.saves, prev.saves),
  `- Taxa de engajamento por seguidores: ${fmtPct(cur.erFollowers)} (interações ÷ seguidores × 100)`,
  `- Taxa de engajamento por alcance: ${fmtPct(cur.erReach)} (interações ÷ alcance × 100)`,
].join('\n')}`);
  if (series.followers.length || series.reach.length) {
    s.push(`## Evolução dentro do mês (por período cadastrado)
${series.followers.length ? `- Seguidores: ${series.followers.map((p) => `${p.label}=${fmtInt(p.value)}`).join(', ')}` : ''}
${series.reach.length ? `- Alcance: ${series.reach.map((p) => `${p.label}=${fmtInt(p.value)}`).join(', ')}` : ''}
${series.er.length ? `- Engajamento por alcance (%): ${series.er.map((p) => `${p.label}=${fmtDec(p.value)}`).join(', ')}` : ''}`);
  }
  s.push(`## Conteúdos publicados no mês: ${d.published.total}
${FORMAT_GROUPS.map((g) => `- ${g.plural}: ${d.published.byFormat[g.id]}`).join('\n')}`);
  if (d.contents.length) {
    s.push(`## Desempenho por conteúdo (resultado final usado no relatório)
${row(['Título', 'Formato', 'Data', 'Pilares', 'Objetivos', 'Coleta usada', 'Métricas'])}
${row(['---', '---', '---', '---', '---', '---', '---'])}
${d.contents.map((c) => row([c.title, c.group, c.date, c.tags.join(', '), c.objectives.join(', '), c.collected ? `${c.collected.label} em ${c.collected.on}${c.collected.final ? ' (final)' : ''}` : null, metricLine(c)])).join('\n')}

Chaves das métricas: reach=alcance, impressions=impressões, views=visualizações, likes=curtidas, comments=comentários, shares=compartilhamentos, saves=salvamentos, clicks=cliques, profile_visits=visitas ao perfil, new_followers=novos seguidores atribuídos, engagement_rate=taxa de engajamento (%), leads, conversions=conversões, replies=respostas, link_clicks=cliques em link, retention=retenção (%).`);
  }
  if (d.rankings.length) s.push(`## Rankings (melhor conteúdo em cada indicador)\n${d.rankings.map((r) => `- ${r.def.title}: ${r.entries.slice(0, 3).map((e) => `“${e.title}” (${r.def.unit === 'pct' ? fmtPct(e.value) : fmtInt(e.value)})`).join('; ')}`).join('\n')}`);
  if (d.formats.length) s.push(`## Comparação por formato (médias)\n${d.formats.map((f) => `- ${f.plural} (${f.count}): alcance médio ${fmtInt(f.reach)}, engajamento médio ${fmtPct(f.er)}, compartilhamentos ${fmtDec(f.shares)}, salvamentos ${fmtDec(f.saves)}, cliques ${fmtDec(f.clicks)}, conversões ${fmtInt(f.conversions)}`).join('\n')}`);
  if (d.pillars.length) s.push(`## Desempenho por pilar de conteúdo\n${d.pillars.map((p) => `- ${p.tag} (${p.count}): alcance médio ${fmtInt(p.reach)}, engajamento ${fmtPct(p.er)}, salvamentos médios ${fmtDec(p.saves)}, cliques médios ${fmtDec(p.clicks)}, conversões ${fmtInt(p.conversions)}`).join('\n')}`);
  if (d.objectives.length) s.push(`## Resultado por objetivo\n${d.objectives.map((o) => `- ${o.objective} (${o.count}): ${o.metricLabel} = ${fmtDec(o.value)}${o.best ? `; melhor: “${o.best.title}”` : ''}`).join('\n')}`);
  if (d.funnel.length) s.push(`## Funil\n${d.funnel.map((f) => `- ${f.label}: ${fmtInt(f.value)}`).join('\n')}`);
  if (d.paid) {
    const p = d.paid.totals;
    s.push(`## Tráfego pago
- Investimento: ${fmtMoney(p.investment)} | Impressões: ${fmtInt(p.impressions)} | Alcance: ${fmtInt(p.reach)} | Cliques: ${fmtInt(p.clicks)} | CTR: ${fmtPct(p.ctr)} | CPC: ${fmtMoney(p.cpc)} | CPM: ${fmtMoney(p.cpm)}
- Leads: ${fmtInt(p.leads)} | CPL: ${fmtMoney(p.cpl)} | Conversões: ${fmtInt(p.conversions)} | CPA: ${fmtMoney(p.cpa)} | Receita: ${fmtMoney(p.revenue)} | ROAS: ${fmtRatio(p.roas)}
${d.paid.campaigns.map((c) => `- Campanha “${c.name}” (${c.platform}${c.objective ? `, objetivo: ${c.objective}` : ''}): investimento ${fmtMoney(c.totals.investment)}, cliques ${fmtInt(c.totals.clicks)}, leads ${fmtInt(c.totals.leads)}, conversões ${fmtInt(c.totals.conversions)}, ROAS ${fmtRatio(c.totals.roas)}`).join('\n')}`);
  }
  if (d.organicPaid.length) s.push(`## Orgânico × pago (conteúdos impulsionados)\n${d.organicPaid.map((o) => `- “${o.title}” (${o.campaigns.join(', ')}): orgânico alcance ${fmtInt(o.organic.reach)}, cliques ${fmtInt(o.organic.clicks)} | pago alcance ${fmtInt(o.paid.reach)}, cliques ${fmtInt(o.paid.clicks)}, conversões ${fmtInt(o.paid.conversions)}, investimento ${fmtMoney(o.paid.investment)}`).join('\n')}\n(Alcance e impressões não devem ser somados entre orgânico e pago.)`);
  if (d.autoInsights.length) s.push(`## Observações automáticas já calculadas\n${d.autoInsights.map((i) => `- ${i.text}`).join('\n')}`);
  const written = REPORT_TEXT_FIELDS.filter((f) => edits.texts[f.key]?.trim());
  if (written.length) s.push(`## Textos que eu já escrevi (mantenha o meu tom e não contradiga)\n${written.map((f) => `### ${f.label}\n${edits.texts[f.key]}`).join('\n\n')}`);
  return s.join('\n\n').replace(/\n{3,}/g, '\n\n');
}
