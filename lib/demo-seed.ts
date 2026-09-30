import 'server-only';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { MEDIA_BUCKET } from '@/lib/constants';
import type { ContentFormat, ContentStatus } from '@/lib/types';

/**
 * Dados de demonstração: 1 cliente fictício + 9 conteúdos
 * (3 posts, 2 carrosséis, 2 reels, 2 stories) com placeholders SVG
 * nas cores da identidade Soltria, enviados ao Supabase Storage.
 */

const WINE = '#771430';
const INK = '#282828';
const BLUSH = '#ffe7e5';
const WHITE = '#ffffff';

const PALETTES = [
  { bg: WINE, fg: WHITE, soft: BLUSH },
  { bg: BLUSH, fg: WINE, soft: WINE },
  { bg: INK, fg: BLUSH, soft: WHITE },
  { bg: WHITE, fg: WINE, soft: INK },
];

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function star(cx: number, cy: number, r: number, fill: string) {
  const k = r * 0.09;
  return `<path d="M${cx},${cy - r} C${cx + k},${cy - k} ${cx + k},${cy - k} ${cx + r},${cy} C${cx + k},${cy + k} ${cx + k},${cy + k} ${cx},${cy + r} C${cx - k},${cy + k} ${cx - k},${cy + k} ${cx - r},${cy} C${cx - k},${cy - k} ${cx - k},${cy - k} ${cx},${cy - r} Z" fill="${fill}"/>`;
}

function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur = `${cur} ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function placeholderSvg(opts: { w: number; h: number; palette: number; title: string; label: string; counter?: string }) {
  const { w, h } = opts;
  const p = PALETTES[opts.palette % PALETTES.length];
  const lines = wrap(opts.title, w > 1000 && h < 1500 ? 16 : 14);
  const size = Math.round(w * 0.085);
  const startY = h / 2 - ((lines.length - 1) * size * 1.15) / 2;
  const text = lines
    .map(
      (l, i) =>
        `<text x="${w / 2}" y="${startY + i * size * 1.15}" text-anchor="middle" font-family="'Bodoni Moda', 'Playfair Display', Georgia, serif" font-size="${size}" fill="${p.fg}">${esc(l)}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="${p.bg}"/>
<rect x="${w * 0.05}" y="${w * 0.05}" width="${w * 0.9}" height="${h - w * 0.1}" fill="none" stroke="${p.fg}" stroke-opacity="0.35" stroke-width="2"/>
${star(w * 0.82, h * 0.16, w * 0.09, p.soft)}${star(w * 0.72, h * 0.22, w * 0.03, p.soft)}${star(w * 0.18, h * 0.84, w * 0.05, p.soft)}
${text}
<text x="${w / 2}" y="${h * 0.9}" text-anchor="middle" font-family="Poppins, Helvetica, Arial, sans-serif" font-weight="300" font-size="${Math.round(w * 0.024)}" letter-spacing="${w * 0.008}" fill="${p.fg}" fill-opacity="0.85">${esc(opts.label.toUpperCase())}</text>
${opts.counter ? `<text x="${w * 0.1}" y="${h * 0.1}" font-family="Poppins, Helvetica, Arial, sans-serif" font-weight="300" font-size="${Math.round(w * 0.026)}" letter-spacing="${w * 0.006}" fill="${p.fg}">${esc(opts.counter)}</text>` : ''}
</svg>`;
}

function avatarSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${WINE}"/><text x="200" y="262" text-anchor="middle" font-family="'Bodoni Moda', Georgia, serif" font-size="230" fill="${WHITE}">L</text>${star(318, 92, 34, BLUSH)}</svg>`;
}

type Item = {
  format: ContentFormat;
  title: string;
  offset: number; // dias a partir de hoje
  time: string;
  status: ContentStatus;
  slides: number; // imagens (post=1, reel=capa)
  objective: string;
  caption: string;
  cta: string;
  hashtags: string;
  duration?: number;
};

const ITEMS: Item[] = [
  { format: 'post', title: 'Boas-vindas ao mês do autocuidado', offset: -10, time: '10:00', status: 'published', slides: 1, objective: 'Engajamento', caption: 'Setembro é sobre voltar para você. ✨\n\nPreparamos um mês inteiro de conteúdos para cuidar da sua pele com carinho e ciência.', cta: 'Salve este post para não esquecer!', hashtags: '#autocuidado #estetica #peleluminosa' },
  { format: 'carousel', title: '5 mitos sobre skincare', offset: -6, time: '12:00', status: 'published', slides: 4, objective: 'Educar', caption: 'Você acredita em algum desses mitos? 👀\n\nDesliza para descobrir a verdade sobre cada um.', cta: 'Compartilhe com quem precisa ver isso.', hashtags: '#skincare #mitosverdades #cuidadocomapele' },
  { format: 'reel', title: 'Bastidores do protocolo glow', offset: -3, time: '18:30', status: 'approved', slides: 1, objective: 'Alcance', caption: 'Um pedacinho dos bastidores do nosso protocolo glow. 💫', cta: 'Agende sua avaliação pelo link da bio.', hashtags: '#bastidores #protocologlow #estetica', duration: 28 },
  { format: 'post', title: 'Depoimento: Mariana', offset: 1, time: '09:00', status: 'pending_approval', slides: 1, objective: 'Prova social', caption: '“Saí da clínica me sentindo outra pessoa.” — Mariana\n\nObrigada pela confiança de sempre. ♡', cta: 'Quer ser a próxima? Chame no direct.', hashtags: '#depoimento #resultadosreais' },
  { format: 'story', title: 'Enquete: qual tratamento?', offset: 2, time: '11:00', status: 'pending_approval', slides: 3, objective: 'Interação', caption: '3 telas: apresentação, enquete e convite para o direct.', cta: 'Responda a enquete!', hashtags: '' },
  { format: 'carousel', title: 'Guia: rotina noturna', offset: 3, time: '19:00', status: 'changes_requested', slides: 4, objective: 'Educar', caption: 'Sua rotina noturna em 4 passos simples. 🌙\n\nDesliza e monte a sua.', cta: 'Salve para montar sua rotina.', hashtags: '#rotinanoturna #skincare' },
  { format: 'story', title: 'Agenda da semana', offset: 4, time: '08:30', status: 'scheduled', slides: 2, objective: 'Conversão', caption: '2 telas com os horários disponíveis.', cta: 'Chame para agendar.', hashtags: '' },
  { format: 'reel', title: '3 dicas para pele radiante', offset: 6, time: '18:00', status: 'pending_approval', slides: 1, objective: 'Alcance', caption: '3 dicas simples para uma pele radiante todos os dias. 🌸', cta: 'Siga para mais dicas.', hashtags: '#peleradiante #dicasdebeleza', duration: 35 },
  { format: 'post', title: 'Promoção de outubro', offset: 7, time: '10:00', status: 'revised_pending', slides: 1, objective: 'Conversão', caption: 'Outubro chegou com condições especiais. 🎀\n\nAgende sua avaliação e garanta seu horário.', cta: 'Link da bio para agendar.', hashtags: '#promocao #outubrorosa #estetica' },
];

function dateFromOffset(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const ago = (days: number, hour = 14) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 12, 0, 0);
  return d.toISOString();
};

export async function seedDemo(ownerId: string): Promise<{ clientId: string }> {
  const db = createAdminClient();
  const clientId = randomUUID();

  const upload = async (path: string, svg: string) => {
    const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, Buffer.from(svg), {
      contentType: 'image/svg+xml',
      upsert: true,
    });
    if (error) throw new Error(`Falha no upload do placeholder: ${error.message}`);
    return path;
  };

  const avatarPath = await upload(`${ownerId}/${clientId}/avatar/${randomUUID()}.svg`, avatarSvg());
  await db.from('clients').insert({
    id: clientId,
    owner_id: ownerId,
    company_name: 'Lumière Estética Avançada',
    slug: `lumiere-estetica-${clientId.slice(0, 4)}`,
    instagram_handle: 'lumiere.estetica',
    display_name: 'Lumière Estética',
    bio: 'Estética avançada & autocuidado ✨\nProtocolos personalizados para a sua pele.\n📍 Agende sua avaliação ↓',
    contact_name: 'Camila Moraes',
    contact_email: null,
    avatar_path: avatarPath,
    notes: 'Cliente fictício de demonstração. Pode excluir quando quiser.',
  });
  await db.from('projects').insert({ client_id: clientId, name: 'Projeto Lumière · Calendário do mês' });
  const { data: project } = await db.from('projects').select('id').eq('client_id', clientId).single();

  const log = (contentId: string | null, actor: 'admin' | 'client' | 'system', name: string, action: string, detail: string, at: string) =>
    db.from('activity_logs').insert({ client_id: clientId, content_id: contentId, actor_type: actor, actor_name: name, action, detail, created_at: at });

  let n = 0;
  for (const it of ITEMS) {
    n++;
    const isVertical = it.format === 'reel' || it.format === 'story' || it.format === 'video';
    const w = 1080;
    const h = isVertical ? 1920 : 1350;
    const hasV2 = it.status === 'revised_pending';

    const { data: item } = await db
      .from('content_items')
      .insert({
        client_id: clientId,
        project_id: project!.id,
        title: it.title,
        format: it.format,
        scheduled_date: dateFromOffset(it.offset),
        scheduled_time: it.time,
        objective: it.objective,
        internal_notes: 'Conteúdo de demonstração.',
        status: it.status,
        current_version: hasV2 ? 2 : 1,
        sent_at: it.status === 'draft' ? null : ago(4),
        approved_at: it.status === 'approved' ? ago(1) : null,
        approved_by: it.status === 'approved' ? 'Camila Moraes' : null,
      })
      .select('id')
      .single();
    const contentId = item!.id as string;

    const versionIds: string[] = [];
    for (const vn of hasV2 ? [1, 2] : [1]) {
      const { data: v } = await db
        .from('content_versions')
        .insert({
          content_id: contentId,
          version_number: vn,
          caption: vn === 1 && hasV2 ? 'Outubro chegou! Agende sua avaliação.' : it.caption,
          cta: it.cta,
          hashtags: it.hashtags,
          duration_seconds: it.duration ?? null,
          note: vn === 2 ? 'Ajustei o título e a cor do fundo conforme o pedido.' : '',
        })
        .select('id')
        .single();
      versionIds.push(v!.id as string);

      const kind = it.format === 'reel' || it.format === 'video' ? 'cover' : 'image';
      for (let s = 0; s < it.slides; s++) {
        const palette = (n + s + (vn === 2 ? 1 : 0)) % PALETTES.length;
        const label = it.slides > 1 ? `${it.format === 'story' ? 'Tela' : 'Slide'} ${String(s + 1).padStart(2, '0')}` : it.format === 'reel' ? 'Capa do Reel' : 'Lumière Estética';
        const path = await upload(
          `${ownerId}/${clientId}/${contentId}/${randomUUID()}.svg`,
          placeholderSvg({ w, h, palette, title: it.slides > 1 ? `${it.title} — ${s + 1}` : it.title, label, counter: it.slides > 1 ? `${s + 1}/${it.slides}` : undefined }),
        );
        await db.from('content_media').insert({
          content_id: contentId,
          version_id: v!.id,
          kind,
          storage_path: path,
          position: s,
          mime_type: 'image/svg+xml',
        });
      }
    }

    // ── histórico/comentários de demonstração ──
    await log(contentId, 'admin', 'Soltria', 'created', 'Conteúdo criado', ago(9));
    if (it.status !== 'draft') await log(contentId, 'admin', 'Soltria', 'sent', 'Enviado para aprovação (versão 01)', ago(4));
    if (it.status === 'approved') {
      await db.from('approvals').insert({ content_id: contentId, version_id: versionIds[0], action: 'approved', client_name: 'Camila Moraes', created_at: ago(1) });
      await log(contentId, 'client', 'Camila Moraes', 'approved', 'Aprovou a versão 01', ago(1));
    }
    if (it.status === 'changes_requested') {
      await db.from('comments').insert([
        { content_id: contentId, version_id: versionIds[0], author_type: 'client', author_name: 'Camila Moraes', message: 'Trocar essa frase por algo mais leve.', slide_index: 3, created_at: ago(2, 10) },
        { content_id: contentId, version_id: versionIds[0], author_type: 'client', author_name: 'Camila Moraes', message: 'Adorei a ideia! Só ajustaria o texto do slide 3 e a ordem dos passos.', is_change_request: true, created_at: ago(2, 10) },
        { content_id: contentId, version_id: versionIds[0], author_type: 'admin', author_name: 'Soltria', message: 'Claro! Já anotei aqui e vou subir a nova versão.', created_at: ago(2, 15) },
      ]);
      await db.from('approvals').insert({ content_id: contentId, version_id: versionIds[0], action: 'changes_requested', client_name: 'Camila Moraes', note: 'Ajustar slide 3', created_at: ago(2, 10) });
      await log(contentId, 'client', 'Camila Moraes', 'changes_requested', 'Solicitou alteração', ago(2, 10));
    }
    if (hasV2) {
      await db.from('comments').insert([
        { content_id: contentId, version_id: versionIds[0], author_type: 'client', author_name: 'Camila Moraes', message: 'Poderíamos mudar o título e deixar o fundo mais elegante?', is_change_request: true, created_at: ago(3, 11) },
        { content_id: contentId, version_id: versionIds[1], author_type: 'admin', author_name: 'Soltria', message: 'Claro! Ajustei e subi a nova versão.', created_at: ago(1, 9) },
      ]);
      await db.from('approvals').insert({ content_id: contentId, version_id: versionIds[0], action: 'changes_requested', client_name: 'Camila Moraes', note: 'Mudar título e fundo', created_at: ago(3, 11) });
      await log(contentId, 'client', 'Camila Moraes', 'changes_requested', 'Solicitou alteração', ago(3, 11));
      await log(contentId, 'admin', 'Soltria', 'new_version', 'Nova versão adicionada (versão 02)', ago(1, 9));
      await log(contentId, 'admin', 'Soltria', 'sent', 'Enviado para aprovação (versão 02)', ago(1, 9));
    }
  }
  return { clientId };
}
