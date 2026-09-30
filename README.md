# Soltria · Portal de Aprovação de Conteúdo

Sistema completo para cadastrar conteúdos por cliente, gerar um **link exclusivo** e receber aprovações, pedidos de alteração e comentários — com calendário editorial, preview estilo Instagram, simulador de feed e versionamento.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage) · dnd-kit.

## Identidade visual (extraída do PDF)

| Item | Aplicação |
|---|---|
| Cores | Vinho `#771430`, Grafite `#282828`, Rosé `#ffe7e5`, Branco — tokens em `app/globals.css` |
| Tipografia | **Against** (títulos) · **Emitha** (saudações em script) · **Poppins Light** (texto) |
| Logo e elementos | Logo, pincel, pincelada, brilhos e raios recortados do PDF → `public/brand/` (versões branca e vinho) |
| Formas | Botões em pílula, cards com cantos 24px e borda fina vinho, poucas sombras, estrela de 4 pontas como detalhe |

> **Fontes:** Against e Emitha são licenciadas e não estão no Google Fonts. Enquanto não forem adicionadas, o sistema usa *Bodoni Moda* e *Mrs Saint Delafield* como substitutas. Para usar as originais, coloque `against.woff2` e `emitha.woff2` em `public/fonts/` (já referenciadas em `globals.css`).

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
supabase/migrations/0001_init.sql
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
3. **SQL Editor** → cole `supabase/migrations/0001_init.sql` → Run.
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

