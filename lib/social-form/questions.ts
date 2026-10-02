/**
 * FORMULÁRIO DE PERFIL (Social Mídia) — o que a Soltria precisa saber para entender o cliente, o público
 * e os perfis de que ele gosta. Perguntas sobre o NEGÓCIO e as redes (nada de documentos ou dados sensíveis).
 */
export type QuestionType = 'text' | 'textarea' | 'select' | 'multi' | 'list' | 'links' | 'colors' | 'scale';

/** Grupos de arquivos que o cliente pode enviar (fotos, logo, referências…). */
export const FILE_GROUPS = [
  { id: 'logo', label: 'Logo e identidade visual', hint: 'Logo (de preferência PNG, SVG ou PDF), manual da marca, paleta, fontes.' },
  { id: 'team', label: 'Fotos suas e da equipe', hint: 'Fotos de rosto e de corpo inteiro, com boa luz.' },
  { id: 'space', label: 'Fotos do espaço', hint: 'Consultório, loja, fachada, recepção, ambiente de atendimento.' },
  { id: 'work', label: 'Fotos de trabalhos, produtos e resultados', hint: 'O que você faz e entrega. Só use fotos de clientes com autorização.' },
  { id: 'refs', label: 'Referências visuais', hint: 'Prints de posts, perfis e estilos que você gosta.' },
  { id: 'other', label: 'Outros arquivos', hint: 'Tabela de preços, apresentação, catálogo, vídeos…' },
] as const;
export type FileGroup = (typeof FILE_GROUPS)[number]['id'];
export const LINK_KINDS = ['Instagram', 'Site', 'WhatsApp', 'Pasta no Drive / Dropbox', 'Manual da marca', 'Canva / Figma', 'Google Meu Negócio', 'TikTok', 'YouTube', 'LinkedIn', 'Linktree / página de links', 'Outro'] as const;

export interface SocialFile {
  id: string;
  path: string;
  name: string;
  mime: string;
  group: FileGroup;
  caption: string;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  hint?: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  /** type 'scale': rótulos das pontas (1 e 5). */
  scale?: [string, string];
}
export interface Section {
  id: string;
  title: string;
  intro?: string;
  questions: Question[];
  /** mostra a área de envio de arquivos (fotos, logo…) nesta seção. */
  files?: boolean;
}

export type FormKind = 'clinic' | 'business';
export const KIND_LABEL: Record<FormKind, string> = { clinic: 'Consultório / clínica', business: 'Outras empresas' };

const OBJECTIVES = ['Ser mais conhecido(a) na região', 'Gerar mais agendamentos / contatos', 'Vender mais produtos ou serviços', 'Construir autoridade na área', 'Fortalecer a marca / posicionamento', 'Atrair um público mais qualificado', 'Fidelizar quem já é cliente', 'Divulgar um lançamento ou novidade'];
const NETWORKS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn', 'Pinterest', 'WhatsApp / Canal', 'Site / blog', 'Google Meu Negócio'];
const FORMATS = ['Reels (vídeos curtos)', 'Carrosséis', 'Posts de uma imagem', 'Stories', 'Vídeos mais longos', 'Lives', 'Bastidores', 'Depoimentos'];
const CONTENT_KINDS = ['Educativo (dicas e explicações)', 'Bastidores do dia a dia', 'Antes e depois / resultados', 'Depoimentos e provas sociais', 'Humor e trends', 'Inspiração / frases', 'Promoções e ofertas', 'Quebra de objeções / dúvidas', 'Histórias pessoais', 'Notícias e novidades da área'];
const TONES = ['Elegante', 'Acolhedora', 'Divertida', 'Direta e objetiva', 'Técnica e didática', 'Inspiradora', 'Sofisticada', 'Próxima e informal', 'Ousada', 'Séria e institucional'];

const objetivos = (extra: Question[] = []): Section => ({
  id: 'objetivos',
  title: 'Objetivos nas redes',
  questions: [
    { id: 'objectives', label: 'O que você quer alcançar com as redes sociais?', type: 'multi', required: true, options: OBJECTIVES, hint: 'Marque até 3 principais.' },
    { id: 'goal_3m', label: 'Como seria um bom resultado daqui a 3 a 6 meses?', type: 'textarea', placeholder: 'Ex.: 20 agendamentos por mês pelo Instagram' },
    { id: 'conversion', label: 'Como o cliente entra em contato hoje?', type: 'multi', options: ['WhatsApp', 'Direct do Instagram', 'Ligação', 'Site / formulário', 'Pessoalmente', 'Indicação'] },
    ...extra,
    { id: 'priority_month', label: 'Qual é a prioridade número 1 para o próximo mês?', type: 'textarea' },
    { id: 'seasonal', label: 'Quais datas e épocas do ano são importantes para o seu negócio?', type: 'multi', options: ['Carnaval', 'Dia da Mulher', 'Páscoa', 'Dia das Mães', 'Dia dos Namorados', 'Dia dos Pais', 'Dia do Cliente', 'Black Friday', 'Natal', 'Réveillon', 'Aniversário da empresa', 'Alta temporada (verão / férias)'] },
    { id: 'launches', label: 'Tem algum lançamento, evento, campanha ou data importante nos próximos meses?', type: 'textarea' },
  ],
});

const perfil: Section = {
  id: 'perfil',
  title: 'Como está o seu perfil hoje',
  questions: [
    { id: 'networks', label: 'Em quais redes você tem presença?', type: 'multi', options: NETWORKS },
    { id: 'posting_now', label: 'Com que frequência você posta hoje?', type: 'select', options: ['Não posto', 'Raramente', '1 a 2 vezes por semana', '3 a 4 vezes por semana', 'Quase todo dia'] },
    { id: 'worked', label: 'O que já funcionou bem nas suas redes?', type: 'textarea', hint: 'Posts que engajaram, que geraram contatos, formatos que deram certo.' },
    { id: 'not_worked', label: 'O que não funcionou ou você não quer mais repetir?', type: 'textarea' },
    { id: 'who_posts', label: 'Quem cuida das redes hoje?', type: 'select', options: ['Eu mesma(o)', 'Alguém da equipe', 'Outra agência / profissional', 'Ninguém'] },
    { id: 'paid', label: 'Você já investiu em anúncios (tráfego pago)?', type: 'select', options: ['Nunca', 'Já fiz, mas parei', 'Faço atualmente', 'Quero começar'] },
    { id: 'dm_reply', label: 'Quem responde as mensagens (direct e WhatsApp) e em quanto tempo?', type: 'text', placeholder: 'Ex.: a secretária, em até 1 hora' },
    { id: 'biggest_challenge', label: 'Qual é a sua maior dificuldade com as redes sociais?', type: 'textarea' },
  ],
};

const gosto: Section = {
  id: 'gosto',
  title: 'Perfis e conteúdos que você gosta',
  intro: 'Aqui não tem certo ou errado: queremos entender o que faz o seu olho brilhar.',
  questions: [
    { id: 'liked_profiles', label: 'Quais perfis você admira e por quê?', type: 'list', required: true, hint: 'Pode ser da sua área ou de qualquer outra. Escreva o @ e o que você gosta, e toque em Adicionar. Quantos quiser.', placeholder: '@perfil — gosto do jeito leve de explicar' },
    { id: 'competitors', label: 'Quais são seus concorrentes ou perfis parecidos com o seu?', type: 'list', placeholder: '@perfil', hint: 'Um por vez, toque em Adicionar.' },
    { id: 'competitors_like', label: 'O que você acha que eles fazem bem? E o que faria diferente?', type: 'textarea' },
    { id: 'disliked_profiles', label: 'Tem algum perfil de que você NÃO gosta? Por quê?', type: 'list', placeholder: '@perfil — não gosto porque…' },
    { id: 'content_kinds', label: 'Que tipos de conteúdo você mais gosta de ver?', type: 'multi', options: CONTENT_KINDS },
    { id: 'formats', label: 'Quais formatos você prefere?', type: 'multi', options: FORMATS },
    { id: 'viral_like', label: 'Lembra de algum post, vídeo ou campanha que você amou? Cole o link ou descreva', type: 'textarea' },
  ],
};

const voz = (extra: Question[] = []): Section => ({
  id: 'voz',
  title: 'Tom de voz e identidade',
  questions: [
    { id: 'tone', label: 'Como você quer soar nas redes?', type: 'multi', options: TONES, hint: 'Escolha até 4.' },
    ...extra,
    { id: 'formality', label: 'Quão formal deve ser a comunicação?', type: 'scale', scale: ['Bem informal', 'Bem formal'] },
    { id: 'words_use', label: 'Palavras ou expressões que você usa e quer manter', type: 'textarea' },
    { id: 'words_avoid', label: 'Palavras, assuntos ou abordagens que você NÃO quer usar', type: 'textarea' },
    { id: 'visual_identity', label: 'Você já tem identidade visual (logo, cores, fontes)?', type: 'select', options: ['Sim, completa', 'Só o logo', 'Não, vou criar', 'Quero renovar'] },
    { id: 'colors', label: 'Cores que representam o seu negócio (e as que você evita)', type: 'textarea' },
    { id: 'brand_materials', label: 'Link da pasta com logo, fotos e vídeos (Drive, Dropbox…)', type: 'text', placeholder: 'https://' },
  ],
});

const producao = (extra: Question[] = []): Section => ({
  id: 'producao',
  title: 'Produção de conteúdo',
  intro: 'Para planejarmos um calendário que caiba na sua rotina.',
  questions: [
    { id: 'on_camera', label: 'Como você se sente em aparecer em vídeos e fotos?', type: 'select', required: true, options: ['Tranquilo(a), adoro', 'Topo, mas preciso de direção', 'Prefiro aparecer pouco', 'Prefiro não aparecer'] },
    { id: 'who_appears', label: 'Quem pode aparecer nos conteúdos?', type: 'multi', options: ['Eu', 'Equipe', 'Clientes (com autorização)', 'Só mãos / bastidores', 'Ninguém, só artes'] },
    ...extra,
    { id: 'record_freq', label: 'Com que frequência você consegue gravar?', type: 'select', options: ['Toda semana', 'A cada 15 dias', 'Uma vez por mês', 'Só quando dá'] },
    { id: 'record_days', label: 'Quais dias e horários ficam melhores para gravar?', type: 'textarea' },
    { id: 'post_freq', label: 'Quantas publicações por semana você acha viável?', type: 'select', options: ['2 a 3', '3 a 4', '5 ou mais', 'Quero a sugestão da Soltria'] },
    { id: 'confidence', label: 'Quão confortável você está para falar para a câmera?', type: 'scale', scale: ['Nada confortável', 'Super à vontade'] },
    { id: 'time_week', label: 'Quanto tempo por semana você consegue dedicar às redes (aprovar, gravar, responder)?', type: 'select', options: ['Menos de 1 hora', '1 a 2 horas', '3 a 5 horas', 'Mais de 5 horas'] },
    { id: 'approver', label: 'Quem aprova os conteúdos e em quanto tempo costuma responder?', type: 'text', placeholder: 'Ex.: eu, em até 24 horas' },
    { id: 'photos_have', label: 'Você já tem banco de fotos e vídeos do negócio?', type: 'select', options: ['Sim, bastante', 'Algumas', 'Quase nada', 'Nada'] },
  ],
});

const materiais: Section = {
  id: 'materiais',
  title: 'Links, identidade visual e fotos',
  intro: 'Reúna aqui tudo que a gente vai precisar para criar os conteúdos. Pode voltar quantas vezes quiser e adicionar mais depois.',
  files: true,
  questions: [
    { id: 'links', label: 'Links importantes', type: 'links', hint: 'Instagram, site, WhatsApp, pasta com fotos e vídeos, manual da marca, Canva… Escolha o tipo, cole o link e toque em Adicionar.' },
    { id: 'brand_colors', label: 'Cores da sua marca', type: 'colors', hint: 'Escolha no seletor ou digite o código (ex.: #771430). Se não tiver, pule.' },
    { id: 'brand_fonts', label: 'Fontes (letras) que a marca usa', type: 'text', placeholder: 'Ex.: Poppins e Playfair Display' },
    { id: 'brand_rules', label: 'Regras de uso da marca, se houver', type: 'textarea', hint: 'Ex.: o logo nunca pode ficar sobre fundo colorido.' },
  ],
};

const final: Section = {
  id: 'final',
  title: 'Para finalizar',
  questions: [
    { id: 'budget_ads', label: 'Existe verba para anúncios?', type: 'select', options: ['Não por enquanto', 'Até R$ 500 por mês', 'R$ 500 a R$ 2.000 por mês', 'Mais de R$ 2.000 por mês', 'A definir'] },
    { id: 'anything', label: 'Tem mais alguma coisa que precisamos saber?', type: 'textarea' },
  ],
};

/** ── FORMULÁRIO PARA CONSULTÓRIO / CLÍNICA ───────────────────────── */
const CLINIC: Section[] = [
  {
    id: 'sobre',
    title: 'Sobre você e o consultório',
    intro: 'Vamos começar pelo básico: quem você é e como é o seu atendimento.',
    questions: [
      { id: 'business_name', label: 'Qual é o nome do consultório ou da clínica?', type: 'text', required: true },
      { id: 'owner_name', label: 'Como você gosta de ser chamado(a)?', type: 'text', required: true, placeholder: 'Ex.: Dra. Carla' },
      { id: 'specialty', label: 'Qual é a sua especialidade (ou as especialidades da clínica)?', type: 'text', required: true },
      { id: 'registry', label: 'Registro profissional que aparece nas postagens', type: 'text', placeholder: 'Ex.: CRM 00000 / CRO 00000 / RQE', hint: 'A maioria dos conselhos exige esse número nas publicações.' },
      { id: 'instagram', label: 'Qual é o @ do Instagram (ou o link do perfil principal)?', type: 'text', required: true, placeholder: '@seuperfil' },
      { id: 'other_links', label: 'Outros links: site, TikTok, YouTube, WhatsApp comercial', type: 'textarea', placeholder: 'Um link por linha' },
      { id: 'time_in_market', label: 'Há quanto tempo você atua?', type: 'select', options: ['Ainda vou abrir', 'Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'] },
      { id: 'attendance', label: 'Como é o atendimento?', type: 'multi', options: ['Presencial', 'Online / teleconsulta', 'Particular', 'Convênios', 'Domiciliar'] },
      { id: 'city', label: 'Em que cidade e bairro fica o consultório?', type: 'text' },
      { id: 'team', label: 'Quem faz parte da equipe e pode aparecer nas redes?', type: 'textarea', placeholder: 'Ex.: eu, uma secretária, duas profissionais' },
    ],
  },
  {
    id: 'procedimentos',
    title: 'Procedimentos e tratamentos',
    intro: 'Isso nos ajuda a criar conteúdos de verdade sobre o que você realiza.',
    questions: [
      { id: 'procedures', label: 'Quais procedimentos ou tratamentos você realiza?', type: 'textarea', required: true, hint: 'Liste todos, um por linha. Quanto mais completo, melhores os conteúdos.', placeholder: 'Ex.:\nConsulta de rotina\nLimpeza de pele\nPreenchimento labial' },
      { id: 'procedures_focus', label: 'Quais deles você mais quer divulgar agora?', type: 'textarea', hint: 'Os que dão mais retorno, os que você mais gosta de fazer ou os que quer fazer crescer.' },
      { id: 'procedures_avoid', label: 'Algum procedimento que NÃO pode ou NÃO quer divulgar?', type: 'textarea' },
      { id: 'procedures_rules', label: 'Existe alguma regra do seu conselho profissional que precisamos respeitar?', type: 'textarea', hint: 'Ex.: não mostrar antes e depois, não prometer resultado, não divulgar preço.' },
      { id: 'before_after', label: 'Você pode mostrar antes e depois e resultados de pacientes?', type: 'select', options: ['Sim, com autorização do paciente', 'Só em alguns casos', 'Não é permitido na minha área', 'Não quero'] },
      { id: 'first_visit', label: 'Como funciona a primeira consulta? O que o paciente deve esperar?', type: 'textarea' },
      { id: 'equipment', label: 'Tem tecnologias, equipamentos ou métodos que são seu diferencial?', type: 'textarea' },
      { id: 'differentials', label: 'O que faz o paciente escolher você e não outro profissional?', type: 'textarea', required: true },
      { id: 'best_sellers', label: 'Quais atendimentos trazem mais resultado financeiro?', type: 'textarea' },
    ],
  },
  objetivos([{ id: 'agenda', label: 'Como está a sua agenda hoje?', type: 'select', options: ['Lotada', 'Tem horários vagos', 'Muitos horários vagos', 'Quero encher horários específicos'] }]),
  {
    id: 'publico',
    title: 'Seus pacientes',
    intro: 'Quanto mais você descrever o paciente que quer atrair, mais certeiro fica o conteúdo.',
    questions: [
      { id: 'audience', label: 'Descreva o paciente ideal, como se fosse uma pessoa real', type: 'textarea', required: true, hint: 'Idade, rotina, o que busca, o que a incomoda.' },
      { id: 'age_ranges', label: 'Faixa de idade dos pacientes', type: 'multi', options: ['Até 17 anos', '18 a 24', '25 a 34', '35 a 44', '45 a 54', '55 a 64', '65 ou mais', 'Todas as idades'] },
      { id: 'gender', label: 'Para quem você atende?', type: 'multi', options: ['Mulheres', 'Homens', 'Todos os gêneros', 'Crianças', 'Gestantes', 'Idosos', 'Casais', 'Famílias'] },
      { id: 'pains', label: 'Quais são as maiores dúvidas, medos e dores do paciente antes de procurar você?', type: 'textarea' },
      { id: 'objections', label: 'Que objeções você escuta com frequência?', type: 'textarea', placeholder: 'Ex.: “dói?”, “é caro?”, “tenho medo”' },
      { id: 'arrive', label: 'Como os pacientes chegam até você hoje?', type: 'multi', options: ['Indicação de pacientes', 'Indicação de colegas', 'Instagram', 'Google', 'Convênio', 'Anúncios', 'Passa em frente'] },
      { id: 'income', label: 'Perfil de poder aquisitivo', type: 'select', options: ['Popular / acessível', 'Médio', 'Médio-alto', 'Alto / premium', 'Varia bastante'] },
    ],
  },
  perfil,
  gosto,
  voz([{ id: 'language', label: 'Qual o nível de linguagem técnica nos conteúdos?', type: 'select', options: ['Bem simples, para leigos', 'Equilibrada', 'Mais técnica, para quem já entende do assunto'] }]),
  producao([{ id: 'patient_images', label: 'Você tem autorização (termo) para usar imagem e depoimento de pacientes?', type: 'select', options: ['Sim, sempre colho', 'Às vezes', 'Ainda não, preciso começar'] }]),
  materiais,
  final,
];

/** ── FORMULÁRIO PARA OUTRAS EMPRESAS ─────────────────────────────── */
const BUSINESS: Section[] = [
  {
    id: 'sobre',
    title: 'Sobre você e o negócio',
    intro: 'Vamos começar pelo básico: quem você é e o que você faz.',
    questions: [
      { id: 'business_name', label: 'Qual é o nome do seu negócio ou marca?', type: 'text', required: true },
      { id: 'owner_name', label: 'Como você gosta de ser chamado(a)?', type: 'text', required: true },
      { id: 'instagram', label: 'Qual é o @ do Instagram (ou o link do perfil principal)?', type: 'text', required: true, placeholder: '@seuperfil' },
      { id: 'other_links', label: 'Outros links: site, TikTok, YouTube, WhatsApp comercial', type: 'textarea', placeholder: 'Um link por linha' },
      { id: 'business_type', label: 'Qual é a área do seu negócio?', type: 'select', required: true, options: ['Advocacia / contabilidade / consultoria', 'Loja / comércio', 'Alimentação / restaurante', 'Educação / cursos / mentoria', 'Beleza (salão, barbearia, spa)', 'Imóveis / construção / arquitetura', 'Marca pessoal / criador de conteúdo', 'Serviços em geral', 'Outro'] },
      { id: 'what_you_do', label: 'Explique o que você faz como se estivesse contando para um amigo', type: 'textarea', required: true },
      { id: 'time_in_market', label: 'Há quanto tempo o negócio existe?', type: 'select', options: ['Ainda vai começar', 'Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'] },
      { id: 'team', label: 'Quem faz parte da equipe e aparece (ou pode aparecer) nas redes?', type: 'textarea' },
      { id: 'city', label: 'Em que cidade e bairro o negócio atende?', type: 'text', placeholder: 'Se atende online, diga também' },
    ],
  },
  {
    id: 'servicos',
    title: 'Produtos e serviços',
    questions: [
      { id: 'services', label: 'Quais são os seus principais produtos ou serviços?', type: 'textarea', required: true, hint: 'Liste um por linha, do que mais vende ao que mais quer vender.' },
      { id: 'best_sellers', label: 'Qual produto ou serviço traz mais resultado financeiro?', type: 'textarea' },
      { id: 'focus_now', label: 'Qual você quer vender mais agora?', type: 'textarea' },
      { id: 'ticket', label: 'Qual é a faixa de preço média?', type: 'text', placeholder: 'Ex.: de R$ 80 a R$ 300' },
      { id: 'differentials', label: 'O que torna você diferente dos outros da sua área?', type: 'textarea', required: true },
      { id: 'guarantees', label: 'Tem garantias, prazos, formas de pagamento ou entrega que valem destacar?', type: 'textarea' },
    ],
  },
  objetivos(),
  {
    id: 'publico',
    title: 'Seu público',
    intro: 'Quanto mais você descrever a pessoa que quer atrair, mais certeiro fica o conteúdo.',
    questions: [
      { id: 'customer_type', label: 'Você vende principalmente para…', type: 'select', options: ['Pessoas (consumidor final)', 'Empresas (B2B)', 'Os dois'] },
      { id: 'audience', label: 'Descreva o cliente ideal, como se fosse uma pessoa real', type: 'textarea', required: true, hint: 'Idade, o que faz, o que busca, o que o incomoda.' },
      { id: 'age_ranges', label: 'Faixa de idade do público', type: 'multi', options: ['Até 17 anos', '18 a 24', '25 a 34', '35 a 44', '45 a 54', '55 a 64', '65 ou mais', 'Todas as idades'] },
      { id: 'gender', label: 'Para quem você fala?', type: 'multi', options: ['Mulheres', 'Homens', 'Todos os gêneros', 'Casais', 'Famílias', 'Mães e gestantes', 'Crianças e adolescentes', 'Empresas'] },
      { id: 'pains', label: 'Quais são as maiores dúvidas, medos e dores do seu cliente?', type: 'textarea' },
      { id: 'desires', label: 'O que o seu cliente mais deseja alcançar?', type: 'textarea' },
      { id: 'objections', label: 'Que objeções você escuta com frequência?', type: 'textarea', placeholder: 'Ex.: “é caro”, “não tenho tempo”' },
      { id: 'income', label: 'Poder aquisitivo do público', type: 'select', options: ['Popular / acessível', 'Médio', 'Médio-alto', 'Alto / premium', 'Varia bastante'] },
    ],
  },
  perfil,
  gosto,
  voz(),
  producao(),
  materiais,
  final,
];

export const sectionsFor = (kind: FormKind): Section[] => (kind === 'clinic' ? CLINIC : BUSINESS);
export const allQuestions = (kind: FormKind) => sectionsFor(kind).flatMap((s) => s.questions);

export type Answers = Record<string, string | string[]>;

export const isAnswered = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : !!v?.trim());

export function answeredCount(a: Answers, kind: FormKind) {
  const list = allQuestions(kind);
  const answered = list.filter((q) => isAnswered(a[q.id])).length;
  return { answered, total: list.length, pct: list.length ? Math.round((answered / list.length) * 100) : 0 };
}
export const missingRequired = (a: Answers, kind: FormKind) => allQuestions(kind).filter((q) => q.required && !isAnswered(a[q.id]));

const UNION = new Map<string, Question>();
for (const q of [...sectionsFor('clinic'), ...sectionsFor('business')].flatMap((x) => x.questions)) UNION.set(q.id, q);
const HEX = /^#[0-9a-fA-F]{6}$/;
const LINK_OK = new Set<string>(LINK_KINDS);

/** `categoria::endereço` — o formato em que cada link fica guardado. */
export const encodeLink = (kind: string, url: string) => `${kind}::${url}`;
export function decodeLink(v: string): { kind: string; url: string } {
  const i = v.indexOf('::');
  return i < 0 ? { kind: 'Outro', url: v } : { kind: v.slice(0, i), url: v.slice(i + 2) };
}

/**
 * Mantém só respostas de perguntas conhecidas, com tamanho e formato válidos. Aceita as perguntas dos DOIS
 * formulários: ao trocar o tipo, nenhuma resposta já escrita se perde. Respostas antigas em texto viram lista.
 */
export function sanitizeAnswers(raw: unknown, _kind?: FormKind): Answers {
  void _kind;
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const q of UNION.values()) {
    const v = src[q.id];
    if (q.type === 'multi') {
      if (Array.isArray(v)) out[q.id] = v.filter((x): x is string => typeof x === 'string' && !!q.options?.includes(x)).slice(0, 30);
    } else if (q.type === 'list') {
      const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [];
      out[q.id] = arr.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 300)).filter(Boolean).slice(0, 40);
    } else if (q.type === 'links') {
      if (Array.isArray(v)) {
        out[q.id] = v
          .filter((x): x is string => typeof x === 'string')
          .map(decodeLink)
          .map((l) => ({ kind: LINK_OK.has(l.kind) ? l.kind : 'Outro', url: l.url.trim().slice(0, 500) }))
          .filter((l) => l.url)
          .map((l) => encodeLink(l.kind, l.url))
          .slice(0, 40);
      }
    } else if (q.type === 'colors') {
      if (Array.isArray(v)) out[q.id] = v.filter((x): x is string => typeof x === 'string' && HEX.test(x)).map((x) => x.toLowerCase()).slice(0, 12);
    } else if (q.type === 'scale') {
      if (typeof v === 'string' && /^[1-5]$/.test(v)) out[q.id] = v;
    } else if (typeof v === 'string') {
      if (q.type === 'select' && v && !q.options?.includes(v)) continue;
      out[q.id] = v.slice(0, 4000);
    }
  }
  return out;
}

/** Arquivos enviados pelo cliente (ficam em `answers.__files`). */
export function sanitizeFiles(raw: unknown): SocialFile[] {
  if (!Array.isArray(raw)) return [];
  const groups = new Set<string>(FILE_GROUPS.map((g) => g.id));
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({ id: String(f.id ?? ''), path: String(f.path ?? ''), name: String(f.name ?? '').slice(0, 200), mime: String(f.mime ?? '').slice(0, 100), group: (groups.has(String(f.group)) ? f.group : 'other') as FileGroup, caption: String(f.caption ?? '').slice(0, 300) }))
    .filter((f) => f.id && f.path)
    .slice(0, 80);
}
export const filesOf = (raw: unknown): SocialFile[] => sanitizeFiles((raw as Record<string, unknown> | null)?.__files);

/** O tipo fica guardado dentro das próprias respostas (chave `__kind`): não precisa de migration nova. */
export const kindOf = (raw: unknown): FormKind => ((raw as Record<string, unknown> | null)?.__kind === 'clinic' ? 'clinic' : 'business');

export type FormStatus = 'open' | 'submitted';
export const FORM_STATUS_LABEL: Record<FormStatus, string> = { open: 'Aguardando respostas', submitted: 'Respondido' };

/** Texto das respostas (para copiar e usar em IA, proposta ou planejamento). */
export function answersToText(a: Answers, kind: FormKind, files: SocialFile[] = []): string {
  const show = (q: Question) => {
    const v = a[q.id];
    if (q.type === 'links') return (v as string[]).map((x) => { const l = decodeLink(x); return `- ${l.kind}: ${l.url}`; }).join('\n');
    if (q.type === 'list') return (v as string[]).map((x) => `- ${x}`).join('\n');
    if (q.type === 'colors') return (v as string[]).join(', ');
    if (q.type === 'scale') return `${v}/5 (${q.scale?.[0]} → ${q.scale?.[1]})`;
    return Array.isArray(v) ? v.join(', ') : String(v);
  };
  const out = sectionsFor(kind).map((s) => {
    const lines = s.questions.filter((q) => isAnswered(a[q.id])).map((q) => `${q.label}\n${show(q)}`);
    if (s.files && files.length) lines.push('Arquivos enviados\n' + FILE_GROUPS.map((g) => ({ g, list: files.filter((f) => f.group === g.id) })).filter((x) => x.list.length).map((x) => `- ${x.g.label}: ${x.list.map((f) => f.name).join(', ')}`).join('\n'));
    return lines.length ? `## ${s.title}\n\n${lines.join('\n\n')}` : '';
  });
  return out.filter(Boolean).join('\n\n');
}
