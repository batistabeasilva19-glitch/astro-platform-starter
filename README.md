# Soltria · Portal de Aprovação de Conteúdo

Sistema completo para cadastrar conteúdos por cliente, gerar um **link exclusivo** e receber aprovações, pedidos de alteração e comentários — com calendário editorial, preview estilo Instagram, simulador de feed e versionamento.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage) · dnd-kit.

## Identidade visual (extraída do PDF)

| Item | Aplicação |
|---|---|
| Cores | Vinho `#771430`, Grafite `#282828`, Rosé `#ffe7e5`, Branco — tokens em `app/globals.css` |
| Tipografia | **Against** (títulos) · **Emitha** (saudações em script) · **Poppins Light** (texto) |
| Logo e elementos | Logo, pincelada e brilhos recortados do PDF → `public/brand/` (versões branca e vinho) |
| Formas | Botões em pílula, cards com cantos 24px e borda fina vinho, poucas sombras, estrela de 4 pontas como detalhe |

> **Fontes:** Against e Emitha são licenciadas e não estão no Google Fonts. Enquanto não forem adicionadas, o sistema usa *Bodoni Moda* e *Mrs Saint Delafield* como substitutas. Para usar as originais, coloque `against.woff2` e `emitha.woff2` em `public/fonts/` (já referenciadas em `globals.css`).

## Módulos

O sistema tem dois módulos **independentes**, que compartilham clientes, login, Supabase e o visual da Soltria:

| Módulo | Admin | Link público do cliente | Tabelas |
|---|---|---|---|
| **Aprovação de conteúdo** (posts, carrosséis, Reels, Stories, calendário, feed) | `/admin/content`, `/admin/clients` | `/review/<token>` | `content_*`, `comments`, `approvals`, … |
| **Identidade Visual** (conceito, moodboard, logo, cores, tipografia, elementos, aplicações, aprovação final, arquivos) | `/admin/identidades` | `/brand/review/<token>` | `identity_*` |

Cada identidade visual tem projeto, etapas, versões, arquivos, comentários, aprovações, histórico e **link próprio** (copiar / novo link / revogar). Na identidade, o cliente pode **favoritar** propostas de logo (não aprova nada), **escolher** uma proposta, **aprovar**, **solicitar alteração** e **comentar** em cada etapa. As etapas podem ser ativadas/desativadas por projeto.

> **Atualizando um projeto que já está no ar:** rode, em ordem, `0002_identidade_visual.sql` e `0003_identidade_completa.sql` `0004_perfil.sql` (foto do perfil) `0005_links_identidade.sql` (links de acesso rápido) `0006_estrategia.sql` (PDFs de estratégia de rede) `0007_formulario_marca.sql` (etapa “Formulário da marca”) `0008_desempenho.sql` (Desempenho & Relatórios) e `0009_perfil_antes.sql` (print do perfil “antes”) no SQL Editor do Supabase. São só aditivas (criam tabelas/colunas novas) e não alteram nada do módulo de conteúdo.

**O que o módulo de Identidade Visual inclui**
- **Logo:** várias propostas (A, B, C), cada uma com 9 variações de arquivo e **versões próprias** (V1, V2, V3… nunca substituídas), descrição das alterações, comparação **lado a lado / alternar no celular / slider antes↔depois** e, só para a administradora, **“Usar esta versão novamente”** (cria uma nova versão, sem apagar nada). O cliente **favorita** (não aprova), **escolhe** a proposta e, separadamente, **aprova o logo**.
- **Cores:** Paleta 01, 02, 03…; color picker ⇄ HEX, RGB e CMYK automáticos (editáveis), Pantone opcional; no portal: copiar HEX (“Cor copiada ♡”), “♡ Minha favorita”, **Monte sua paleta** (seleção enviada ao admin), **Testar combinação** (fundo/texto/destaque) com contraste WCAG.
- **Tipografia:** fonte principal/secundária/de apoio, arquivo da fonte ou nome do Google Fonts, “Digite algo para testar”, aplicações (título, subtítulo, texto, botão, legenda), comparar Fonte A × B, favoritar e aprovar separadamente.
- **Elementos e Aplicações:** galerias por categoria, imagem em tamanho grande com **zoom** (botões, roda do mouse e pinça) e **comentário em um ponto da imagem** (marcador numerado).
- **Decisões do cliente** (admin): logo favorita/aprovada (e versão), paleta favorita, cores escolhidas, tipografias, alterações solicitadas e favoritos.
- **Aprovação final automática** quando todas as etapas ativas estão aprovadas, com resumo e registro do que foi aprovado.
- **Arquivos finais:** por categoria, com **“Disponibilizar para cliente [ON/OFF]”** por arquivo; só aparecem depois da aprovação, e o download é registrado.

## Desempenho & Relatórios (Redes sociais)

Dentro de cada cliente de Social Mídia: **Desempenho** (`/admin/clients/<id>/desempenho`) e **Relatórios** (`/admin/clients/<id>/relatorios`).

- **Durante o mês** você cadastra: métricas do perfil por período (aba *Dados do perfil*), o desempenho de cada publicação (seção **Desempenho** dentro do conteúdo, com coletas de 24h/7 dias/30 dias que nunca se sobrescrevem, pilares/tags e objetivo) e, se houver, campanhas de tráfego pago.
- O sistema calcula sozinho: crescimento líquido e %, taxas de engajamento (fórmula sempre visível), CTR/CPC/CPM/CPL/CPA/ROAS (— quando falta dado), variação vs. período anterior, rankings por indicador (sem “vencedor único”), comparação por formato/pilar/objetivo, funil, orgânico × pago e análises automáticas (só com dados existentes, todas editáveis).
- **Filtros:** este mês, mês anterior, 3 e 6 meses, ano e período personalizado; aba *Comparar períodos*.
- **Relatório mensal:** “Gerar relatório do mês” monta tudo; você revisa, escreve a análise, salva versões (V1, V2…), visualiza (A4), **exporta PDF** (`Relatorio_Soltria_Cliente_Setembro_2026.pdf`), **finaliza** (congela os dados: mudar métricas depois não altera o relatório; dá para reabrir) e **disponibiliza para o cliente**.
- **Portal do cliente:** cartão **Resultados** em `/review/<token>` — só aparece com relatórios finalizados e liberados; mostra gráficos, melhores conteúdos e análises e permite baixar o PDF. Observações internas e rascunhos nunca saem do painel.
- **Textos com ajuda dos dados:** no editor do relatório, *Preencher automaticamente* redige resumo, resultados, o que funcionou/melhorar, aprendizados, recomendações, próximo mês e a análise de cada seção só com os números cadastrados (sem inventar), e *Dados para a IA* gera um pacote com o pedido + todos os dados do mês para colar na sua IA — a resposta (blocos `### Nome do campo`) volta para os campos com um clique.
- Os dados são inseridos manualmente; a estrutura (origem dos dados por registro) já está pronta para integrar Instagram Graph API / Meta Ads / Google Analytics no futuro.

## Formulário da marca (1ª etapa da Identidade Visual)

Todo projeto novo começa com o **Formulário da marca**: 8 seções de perguntas só sobre a marca (sem telefone nem dados pessoais). O cliente responde pelo link `/brand/review/<token>` (salva automaticamente), **envia fotos de referência** direto do celular, envia o formulário (“Respondido”) e pode reabrir para editar. A administradora vê o resumo, edita as respostas e usa **Baixar formulário (PDF)** (respostas + fotos de referência). Projetos já existentes recebem a etapa desativada; basta ativá-la.

## Estratégia de rede (PDFs por mês)

Em cada cliente de Social Mídia (`/admin/clients/<id>/estrategia`) a administradora sobe PDFs de estratégia, escolhendo o **mês** de cada um, edita título/descrição/mês, oculta ou mostra para o cliente e exclui. No link do cliente (`/review/<token>`) aparece o cartão **Estratégia de rede** (somente se houver documentos visíveis); a página `/review/<token>/estrategia` permite **pesquisar por mês** (e ano) ou por título, abrir e baixar. Os arquivos ficam no bucket privado e o servidor valida o token antes de liberar cada PDF.

## Estrutura

```
app/
  login/                      login da administradora
  admin/                      painel (protegido por middleware + requireUser)
    page.tsx                  dashboard
    clients/…                 lista, novo, editar, workspace (Calendário · Lista · Feed)
    content/…                 lista com filtros, novo, editor (versões, mídias, comentários)
  review/[token]/…            portal do cliente (link exclusivo) + página de cada conteúdo
components/  brand · ui · content · calendar · feed · admin · review
lib/
  supabase/                   client (browser), server (sessão), admin (service role, server-only)
  actions/                    Server Actions: auth, clients, content, portal (cliente)
  data/                       consultas (content, clients, portal)
  notifications.ts            fila/envio de e-mails (estrutura pronta)
  demo-seed.ts                dados de demonstração
supabase/migrations/0001_init.sql          módulo de conteúdo
supabase/migrations/0002_identidade_visual.sql   módulo Identidade Visual
supabase/migrations/0003_identidade_completa.sql  versões de logo, favoritos, comentários na imagem, downloads

app/admin/identidades/…       lista, nova, projeto (etapas)
app/brand/review/[token]/…    portal público da identidade (+ favoritos e download)
components/identity/          editores, visualizações e ações
lib/identity/ lib/data/identity*.ts lib/actions/identity*.ts
```

## Banco de dados (Supabase)

Tabelas: `users, clients, projects, content_items, content_versions, content_media, comments, approvals, feed_layouts, activity_logs, notification_outbox` + bucket privado `media`.

- Legenda/CTA/hashtags e mídias pertencem a uma **versão** (`content_versions`); `content_items.current_version` aponta a atual. Nova versão copia a anterior e preserva tudo.
- **RLS**: toda tabela só é acessível pelo dono (`owner_id = auth.uid()`). No Storage, a administradora só acessa a própria pasta.
- O **portal do cliente não usa RLS/anon**: o servidor valida o token (`projects.review_token`, 64 caracteres aleatórios, sem IDs sequenciais) e usa a *service role*, que **nunca** vai ao navegador (`server-only`).
- Campos internos (observações, objetivo) são removidos antes de chegar ao cliente.

## Rodar localmente

1. `npm install`
2. Crie um projeto em [supabase.com](https://supabase.com).
3. **SQL Editor** → cole e rode, nesta ordem, `supabase/migrations/0001_init.sql` e depois `supabase/migrations/0002_identidade_visual.sql`.
4. **Authentication → Users → Add user** (e-mail + senha, marque *Auto Confirm*). Desative “Allow new users to sign up” em *Authentication → Sign In / Providers*.
5. `cp .env.example .env.local` e preencha (Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (secreta)
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
6. `npm run dev` → http://localhost:3000 → entre e clique em **Carregar dados de demonstração** (cliente fictício, 9 conteúdos: 3 posts, 2 carrosséis, 2 reels, 2 stories).

> Limite de upload: depende do plano Supabase (Free = 50 MB por arquivo). O app aceita imagens até 20 MB e vídeos até 200 MB.

## Deploy na Vercel

1. Suba o repositório no GitHub e importe em [vercel.com/new](https://vercel.com/new) (framework Next.js, sem configurações extras).
2. Em *Settings → Environment Variables* cadastre as variáveis do `.env.example`, com `NEXT_PUBLIC_SITE_URL` = URL final (ex.: `https://aprovacao.seudominio.com`).
3. Deploy. No Supabase, em *Authentication → URL Configuration*, informe a URL do site.

## Fluxo de uso

**Você:** Clientes → cliente → *Novo conteúdo* → suba artes/vídeos (arraste para reordenar slides) → legenda → calendário/feed → *Enviar para aprovação* → *Copiar link de aprovação* → WhatsApp.

**Cliente:** abre `/review/<token>` → vê cards/calendário/feed → abre uma publicação → aprova, solicita alteração ou comenta (inclusive por slide).

**Você:** vê “Alteração solicitada” no dashboard → *Subir nova versão* (V02) → ajusta → *Enviar para aprovação* → cliente aprova a versão atual.

Status: Rascunho → Aguardando aprovação → Aprovado / Alteração solicitada → Alterado — aguardando nova aprovação → Programado → Publicado.

## Links do cliente

Formato: `/review/<token longo>`. No workspace do cliente: **Copiar link de aprovação**, **Novo link** (invalida o anterior), **Revogar** / **Reativar**.

## Notificações por e-mail

`lib/notifications.ts` grava cada evento (aguardando aprovação, alteração solicitada, aprovado) em `notification_outbox` e, se `RESEND_API_KEY`, `NOTIFICATIONS_FROM` e `ADMIN_NOTIFICATION_EMAIL` estiverem definidos, envia via Resend. Para outro provedor, troque só a função `sendEmail`.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`

