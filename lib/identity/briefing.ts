/**
 * FORMULÁRIO DA MARCA — perguntas do briefing de identidade visual.
 * Só perguntas sobre a MARCA: nenhuma pede telefone, e-mail, endereço, documentos ou dados pessoais.
 */
export type QuestionType = 'text' | 'textarea' | 'select' | 'multi';

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  hint?: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}
export interface Section {
  id: string;
  title: string;
  intro?: string;
  questions: Question[];
}

const PERSONALIDADE = ['Elegante', 'Acolhedora', 'Ousada', 'Minimalista', 'Divertida', 'Sofisticada', 'Natural', 'Moderna', 'Clássica', 'Delicada', 'Forte', 'Acessível', 'Premium', 'Criativa', 'Séria', 'Jovem', 'Artesanal', 'Tecnológica', 'Romântica', 'Atemporal'];

export const BRIEFING_SECTIONS: Section[] = [
  {
    id: 'marca',
    title: 'A sua marca',
    intro: 'Vamos começar pelo básico: quem é a sua marca.',
    questions: [
      { id: 'brand_name', label: 'Qual é o nome da marca?', type: 'text', required: true, placeholder: 'Como o nome deve aparecer escrito' },
      { id: 'name_meaning', label: 'Existe uma história ou significado por trás do nome?', type: 'textarea', hint: 'E como ele se pronuncia, se tiver algo diferente.' },
      { id: 'tagline', label: 'A marca tem slogan ou uma frase que a represente?', type: 'text', placeholder: 'Se ainda não tem, deixe em branco' },
      { id: 'stage', label: 'Em que fase a marca está?', type: 'select', options: ['Ainda vai começar', 'Começando (menos de 1 ano)', 'Já estabelecida', 'Quer se reposicionar / renovar'] },
      { id: 'has_identity', label: 'A marca já tem alguma identidade visual (logo, cores, fontes)?', type: 'select', options: ['Não, é do zero', 'Tem só um logo', 'Tem, mas quer renovar tudo', 'Tem e quer apenas ajustes'] },
      { id: 'keep_change', label: 'O que você gosta e quer manter? O que não funciona mais?', type: 'textarea', hint: 'Responda só se a marca já tem alguma identidade.' },
      { id: 'links', label: 'Links da marca (site, Instagram, portfólio)', type: 'textarea', placeholder: 'Um link por linha', hint: 'Apenas links da marca, não pessoais.' },
    ],
  },
  {
    id: 'negocio',
    title: 'O que a marca faz',
    questions: [
      { id: 'what_it_does', label: 'O que a marca faz? Explique como se estivesse contando para um amigo.', type: 'textarea', required: true },
      { id: 'products', label: 'Quais são os principais produtos ou serviços?', type: 'textarea' },
      { id: 'differentials', label: 'O que torna a marca diferente das outras?', type: 'textarea', hint: 'O que só ela tem ou faz de um jeito próprio.' },
      { id: 'competitors', label: 'Quais marcas são concorrentes ou parecidas com a sua?', type: 'textarea', placeholder: 'Nomes ou @ das marcas' },
      { id: 'not_us', label: 'O que a marca NÃO é e não quer parecer?', type: 'textarea' },
    ],
  },
  {
    id: 'proposito',
    title: 'Propósito e posicionamento',
    questions: [
      { id: 'why', label: 'Por que a marca existe? Qual é o propósito dela?', type: 'textarea' },
      { id: 'promise', label: 'Qual é a promessa da marca para quem a escolhe?', type: 'textarea' },
      { id: 'values', label: 'Quais são os valores que não se negociam?', type: 'textarea', placeholder: 'Ex.: cuidado, transparência, excelência' },
      { id: 'future', label: 'Onde você quer ver a marca daqui a 3 anos?', type: 'textarea' },
    ],
  },
  {
    id: 'publico',
    title: 'Para quem é a marca',
    intro: 'Escolha as opções que mais combinam — pode marcar mais de uma. Isso ajuda a desenhar a marca para as pessoas certas.',
    questions: [
      { id: 'customer_type', label: 'A marca vende principalmente para…', type: 'select', options: ['Pessoas (consumidor final)', 'Empresas (B2B)', 'Os dois'] },
      { id: 'age_ranges', label: 'Qual a faixa de idade do público?', type: 'multi', options: ['Até 17 anos', '18 a 24', '25 a 34', '35 a 44', '45 a 54', '55 a 64', '65 anos ou mais', 'Todas as idades'], hint: 'Marque todas que se aplicam.' },
      { id: 'gender', label: 'Para quem a marca fala?', type: 'multi', options: ['Mulheres', 'Homens', 'Todos os gêneros', 'Público LGBTQIA+', 'Casais', 'Famílias', 'Mães e gestantes', 'Crianças e adolescentes'] },
      { id: 'income', label: 'Qual o poder aquisitivo do público?', type: 'select', options: ['Popular / acessível', 'Médio', 'Médio-alto', 'Alto / premium', 'Varia bastante'] },
      { id: 'lifestyle', label: 'Como é o estilo de vida desse público?', type: 'multi', options: ['Vida corrida', 'Empreendedor(a)', 'Profissional liberal', 'Estudante', 'Família / casa', 'Aventureiro(a)', 'Bem-estar e saúde', 'Fashion e tendências', 'Tecnologia', 'Tradicional', 'Sustentável / consciente', 'Luxo e exclusividade'] },
      { id: 'buy_moment', label: 'O que leva essa pessoa a procurar a marca?', type: 'multi', options: ['Necessidade do dia a dia', 'Autocuidado / se presentear', 'Presentear alguém', 'Ocasião especial', 'Resolver um problema', 'Status e exclusividade', 'Indicação de alguém', 'Curiosidade / novidade'] },
      { id: 'where_area', label: 'Onde esse público está?', type: 'multi', options: ['Bairro / região específica', 'Minha cidade', 'Meu estado', 'Brasil todo', 'Internacional', 'Só online'] },
      { id: 'channels', label: 'Onde esse público passa o tempo e encontra a marca?', type: 'multi', options: ['Instagram', 'TikTok', 'WhatsApp', 'Google', 'Pinterest', 'YouTube', 'LinkedIn', 'Loja física', 'Indicação / boca a boca', 'Eventos'] },
      { id: 'values_audience', label: 'O que esse público mais valoriza?', type: 'multi', options: ['Qualidade', 'Preço justo', 'Atendimento acolhedor', 'Exclusividade', 'Praticidade', 'Estética / beleza', 'Confiança', 'Inovação', 'Sustentabilidade', 'Tradição', 'Resultado rápido', 'Personalização'] },
      { id: 'audience', label: 'Descreva com suas palavras o cliente ideal da marca', type: 'textarea', required: true, hint: 'Como se fosse uma pessoa real: o que ela faz, o que ela busca, o que a incomoda.', placeholder: 'Ex.: Mulher de 30 a 45 anos, profissional ocupada, que quer se cuidar sem perder tempo…' },
      { id: 'feel', label: 'Como a marca quer que as pessoas se sintam ao ter contato com ela?', type: 'multi', options: ['Acolhidas', 'Seguras', 'Especiais', 'Inspiradas', 'Bonitas', 'Confiantes', 'Relaxadas', 'Animadas', 'Pertencentes', 'Empoderadas'] },
    ],
  },
  {
    id: 'personalidade',
    title: 'Personalidade e tom',
    questions: [
      { id: 'adjectives', label: 'Quais palavras descrevem a personalidade da marca?', type: 'multi', options: PERSONALIDADE, hint: 'Escolha até 5.' },
      { id: 'adjectives_no', label: 'E quais palavras NÃO combinam com a marca?', type: 'multi', options: PERSONALIDADE },
      { id: 'tone', label: 'Como a marca conversa?', type: 'select', options: ['Mais formal', 'Equilibrada', 'Mais informal e próxima', 'Divertida e descontraída'] },
      { id: 'person', label: 'Se a marca fosse uma pessoa, como ela seria?', type: 'textarea', hint: 'Como se veste, como fala, o que gosta.' },
    ],
  },
  {
    id: 'visual',
    title: 'Gosto visual',
    intro: 'Aqui não existe certo ou errado — queremos entender o que faz o seu olho brilhar.',
    questions: [
      { id: 'styles', label: 'Quais estilos combinam com a marca?', type: 'multi', options: ['Minimalista', 'Clássico', 'Moderno', 'Orgânico / natural', 'Artesanal', 'Luxuoso', 'Vintage / retrô', 'Geométrico', 'Colorido', 'Neutro / sóbrio', 'Delicado', 'Marcante'] },
      { id: 'colors_like', label: 'Que cores você gosta ou imagina para a marca?', type: 'textarea' },
      { id: 'colors_avoid', label: 'Alguma cor que quer evitar?', type: 'textarea' },
      { id: 'colors_required', label: 'Alguma cor é obrigatória ou tem significado para a marca?', type: 'textarea' },
      { id: 'logo_types', label: 'Que tipo de logo você imagina?', type: 'multi', options: ['Só o nome (logotipo)', 'Símbolo + nome', 'Monograma (iniciais)', 'Emblema / selo', 'Ainda não sei — quero sugestões'] },
      { id: 'fonts', label: 'Que tipo de letra combina mais?', type: 'multi', options: ['Com serifa (clássica)', 'Sem serifa (limpa)', 'Manuscrita / assinatura', 'Display (de destaque)', 'Ainda não sei'] },
      { id: 'admired', label: 'Quais marcas você admira visualmente e por quê?', type: 'textarea', hint: 'Podem ser de qualquer segmento.' },
      { id: 'dislike', label: 'O que você NÃO quer ver na identidade da marca?', type: 'textarea' },
    ],
  },
  {
    id: 'aplicacoes',
    title: 'Onde a marca vai aparecer',
    questions: [
      { id: 'applications', label: 'Onde a identidade será usada?', type: 'multi', options: ['Instagram', 'Site', 'Cartão de visita', 'Papelaria', 'Embalagem', 'Sacola', 'Etiquetas / tags', 'Adesivos', 'Fachada / placa', 'Uniforme', 'Assinatura de e-mail', 'Apresentações', 'Outros'] },
      { id: 'applications_notes', label: 'Existe algo específico que a identidade precisa atender?', type: 'textarea', hint: 'Ex.: tamanho de uma embalagem, regras do ponto de venda, materiais já impressos.' },
    ],
  },
  {
    id: 'extras',
    title: 'Para finalizar',
    questions: [
      { id: 'deadline', label: 'Existe uma data importante para a marca (lançamento, evento)?', type: 'text', placeholder: 'Ex.: lançamento em março' },
      { id: 'anything', label: 'Tem mais alguma coisa que devemos saber sobre a marca?', type: 'textarea' },
    ],
  },
];

export const ALL_QUESTIONS = BRIEFING_SECTIONS.flatMap((s) => s.questions);
export const QUESTION_BY_ID = Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, q])) as Record<string, Question>;
export const REQUIRED_IDS = ALL_QUESTIONS.filter((q) => q.required).map((q) => q.id);

export type Answers = Record<string, string | string[]>;

export const isAnswered = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : !!v?.trim());

export function answeredCount(a: Answers) {
  const answered = ALL_QUESTIONS.filter((q) => isAnswered(a[q.id])).length;
  return { answered, total: ALL_QUESTIONS.length, pct: Math.round((answered / ALL_QUESTIONS.length) * 100) };
}
export const missingRequired = (a: Answers) => ALL_QUESTIONS.filter((q) => q.required && !isAnswered(a[q.id]));

/** Mantém só respostas de perguntas conhecidas, com tamanho e opções válidos. */
export function sanitizeAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const q of ALL_QUESTIONS) {
    const v = (raw as Record<string, unknown>)[q.id];
    if (q.type === 'multi') {
      if (Array.isArray(v)) out[q.id] = v.filter((x): x is string => typeof x === 'string' && !!q.options?.includes(x)).slice(0, 30);
    } else if (typeof v === 'string') {
      if (q.type === 'select' && v && !q.options?.includes(v)) continue;
      out[q.id] = v.slice(0, 4000);
    }
  }
  return out;
}
