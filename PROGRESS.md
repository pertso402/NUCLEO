# PROGRESS.md — NÚCLEO

> Leia este arquivo no início de toda sessão. Marque `[x]` ao concluir cada tarefa,
> registre decisões e escreva uma linha no Log. Uma fase só termina quando todos os critérios de aceite passam.

**Fase atual:** 0
**Próxima tarefa:** 0.4 (bloqueada) · 0.7

---

## Fase 0 — Fundação
- [x] 0.1 Criar projeto Next.js (App Router, TS strict, ESLint, Tailwind) + estrutura de pastas do ARCHITECTURE.md §3
- [x] 0.2 Instalar fontes (Unbounded, Geist, Geist Mono) e tokens do DESIGN.md §2–4 em `globals.css` + `tailwind.config`
- [x] 0.3 Componentes base: `Button`, `HudCard`, `StatTile`, `Chip`, `GridBackground`, `TabBar`, sidebar desktop
- [ ] 0.4 Projeto Supabase + clients (server/client/admin) + Auth por e-mail OTP + middleware protegendo `(app)`
- [ ] 0.5 Migration inicial: `settings`, `principles`, `categories` (com seed), `inbox_messages` + RLS + trigger `updated_at`
- [x] 0.6 `lib/money.ts` e `lib/dates.ts` (fuso SP) + `business-days.ts` com testes
- [ ] 0.7 PWA: manifest, ícones, Serwist, splash; testar "Adicionar à Tela de Início" no iPhone
- [ ] 0.8 Deploy na Vercel com variáveis de ambiente; CI rodando typecheck + lint + test

**Critérios de aceite:** login funciona no iPhone e no PC · app instalado abre em tela cheia · tela vazia já tem a identidade visual (grade, tab bar, fontes) · testes passando.

---

## Fase 1 — Dinheiro + Marcos + Captura (o MVP que precisa ser usado todo dia)
- [ ] 1.1 Migrations: `transactions`, `milestones` + views `v_month_totals`, `v_category_breakdown`
- [ ] 1.2 `lib/metrics/pace.ts` (ARCHITECTURE §6.1) com testes de borda
- [ ] 1.3 `/api/ingest`: auth por token, parser Claude com `add_transaction`, `query`, `undo_last`, `ask_clarification`; log em `inbox_messages`
- [ ] 1.4 Fixtures de parser (mín. 15 frases de dinheiro) + teste
- [ ] 1.5 Tela **Comando** v1: anel do marco, ticker, faltam R$ X, barra de ritmo, projeção (Realtime atualiza ao lançar)
- [ ] 1.6 `CaptureButton` (texto) + `CommandPalette` (Ctrl/Cmd+K) usando `/api/ingest`
- [ ] 1.7 Tela **Dinheiro**: extrato, filtros (mês/scope/categoria), edição inline, relatórios do mês e 12 meses
- [ ] 1.8 Tela **Marcos**: criar/ordenar marcos, linha do tempo de conquistas, celebração ao bater
- [ ] 1.9 Workflow n8n: Evolution → filtro de número → (áudio → ElevenLabs STT) → `/api/ingest` → resposta no WhatsApp. Exportar JSON para `integrations/n8n/`
- [ ] 1.10 Resposta de receita sempre com o novo estado do marco (ARCHITECTURE §5.2)

**Critérios de aceite:** mando "recebi 1500 do cliente X" por áudio no WhatsApp e em < 10s recebo a confirmação com o marco atualizado · o anel no app sobe sozinho · "desfaz" reverte · relatório do mês bate com a soma manual.

---

## Fase 2 — Rotina: tarefas, hábitos, tempo, briefings, Siri e widget
- [ ] 2.1 Migrations: `tasks`, `habits`, `habit_logs`, `time_entries`, `daily_reviews`, `goals`, `recurring_rules`, `push_subscriptions` + `v_habit_streaks`
- [ ] 2.2 Ferramentas do parser: `add_task`, `complete_task`, `log_habit`, `start_timer`, `stop_timer`, `log_time` + fixtures
- [ ] 2.3 Tela **Rotina** (abas Tarefas · Hábitos com heatmap · Tempo)
- [ ] 2.4 Tela **Objetivos** (trimestre, área, porquê, métrica, tarefas vinculadas)
- [ ] 2.5 `lib/metrics/score.ts` + faixa "Hoje" e top 3 tarefas no Comando + princípio do dia
- [ ] 2.6 Endpoints `/api/cron/briefing-manha` e `/api/cron/fechamento-dia` (números no servidor, texto pelo Claude) + schedules no n8n
- [ ] 2.7 Tela **Revisão** (fechamento do dia em 60s + revisão semanal) e `/api/cron/revisao-semanal`
- [ ] 2.8 `/api/widget` + `integrations/scriptable/nucleo-widget.js`
- [ ] 2.9 `integrations/siri/README.md` com passo a passo do Atalho "Lançar no Núcleo"
- [ ] 2.10 Gravação de áudio no `CaptureButton` (segurar pra falar) via `/api/ingest/audio`
- [ ] 2.11 Lançamentos recorrentes gerando `pending_review`

**Critérios de aceite:** briefing chega 07:30 no WhatsApp com números reais · widget mostra o marco na tela inicial do iPhone · "E aí Siri, lançar no Núcleo" funciona · score do dia fecha às 21:30.

---

## Fase 3 — Pipeline (CRM) + Funil reverso
- [ ] 3.1 Migrations: `leads` (com constraints de próxima ação), `lead_events` (trigger de stage), `outreach_logs`, `v_mrr`
- [ ] 3.2 Ferramentas do parser: `create_lead`, `update_lead`, `log_outreach` + fixtures
- [ ] 3.3 Tela **Pipeline**: kanban, detalhe do lead, histórico, ação rápida no mobile
- [ ] 3.4 `lib/metrics/funnel.ts` (ARCHITECTURE §6.3) com testes + painel do funil reverso
- [ ] 3.5 Meta de abordagens automática alimentando o Comando e o score
- [ ] 3.6 Follow-ups no Comando + `/api/cron/followups`
- [ ] 3.7 Análises: taxa por etapa, motivos de perda, origem que mais fecha
- [ ] 3.8 Receita vinculada a lead (`lead_id`) e marco `mrr_arte`

**Critérios de aceite:** não consigo salvar lead vivo sem próxima ação · o Comando mostra "hoje: N abordagens" calculado pelo funil · mover lead pra "fechado" atualiza MRR e o marco.

---

## Fase 4 — Open Finance (Meu Pluggy)
- [ ] 4.1 Ler documentação atual da Pluggy / Meu Pluggy e registrar o fluxo escolhido em Decisões
- [ ] 4.2 `sync_state` + `/api/cron/openfinance-sync` (dedupe por `external_id`)
- [ ] 4.3 Conciliação com lançamentos manuais (valor igual ± 1 dia)
- [ ] 4.4 Revisão em lote dos `pending_review` na tela Dinheiro
- [ ] 4.5 Aviso de expiração do consentimento (15 dias antes)

**Critérios de aceite:** transações do banco aparecem sem duplicar as que lancei pelo WhatsApp · consigo confirmar 20 lançamentos em < 1 minuto.

---

## Fase 5 — Polimento
- [ ] 5.1 Web Push (VAPID) espelhando briefings
- [ ] 5.2 Feriados nacionais em `holidays` no cálculo de dias úteis
- [ ] 5.3 Animações finais (scan, stagger) + `prefers-reduced-motion`
- [ ] 5.4 E2E Playwright no viewport 375×812
- [ ] 5.5 Exportação CSV de transações e leads
- [ ] 5.6 Revisão de performance no iPhone 11 Pro (Lighthouse mobile ≥ 90)

---

## Decisões tomadas
- 2026-11-12 — PWA em vez de app nativo (iPhone sem custo de anuidade da Apple; reavaliar após 30 dias de uso diário).
- 2026-11-12 — Pessoal e ARTe juntos, diferenciados por `scope` deduzido automaticamente.
- 2026-11-12 — Lógica de negócio no código; n8n apenas como ponte de WhatsApp/áudio e agendador.
- 2026-11-12 — Dark-only, design system "Obsidiana Volt".
- 2026-11-12 — Raiz do repositório = pasta `JARVIS` (equivale a `nucleo/` do ARCHITECTURE §3); docs renomeados de `CLAUDE (1).md`/`ARCHITECTURE (1).md` para os nomes canônicos.
- 2026-11-12 — Next.js 16.4 (template atual): `middleware.ts` passa a se chamar `proxy.ts`; Tailwind v4 configurado via CSS (`@theme` em `globals.css`), sem `tailwind.config.ts`.
- 2026-11-12 — `cacheComponents`/`partialPrefetching` desligados: app é 100% autenticado e dinâmico (single-user), o modelo de Suspense obrigatório só adicionaria complexidade.
- 2026-11-12 — Login por **código de 6 dígitos** (OTP por e-mail, `verifyOtp`) em vez de magic link: o link abriria no Safari e não na PWA instalada. `shouldCreateUser: false` — só o usuário do Peter, criado uma vez no painel.
- 2026-11-12 — `proxy.ts` falha fechado: sem variáveis do Supabase responde 503 em tudo menos `/login`. `/api/*` fica fora do matcher (autentica por token).
- 2026-11-12 — Seed de `settings` + categorias por **trigger em `auth.users`** (`seed_user_defaults`), pois numa migration não existe `auth.uid()`. A migration também semeia usuários já existentes. Funções `security definer` com `search_path = ''` e `execute` revogado de anon/authenticated.
- 2026-11-12 — PWA com `@serwist/turbopack` (o `@serwist/next` exige webpack; Next 16 builda com Turbopack). SW servido por route handler em `/serwist/sw.js`, desligado em dev. `/api`, `/auth` e Supabase sempre `NetworkOnly`. Ícones gerados por `scripts/generate-icons.mjs` (N geométrico em paths, sem depender de fonte instalada).
- 2026-11-12 — Banco: projeto Supabase **existente** do Peter (`tarulbqnnbqdrvwsphcw`), compartilhado com outros sistemas (schema `prospector`, `public.leads/conversas/mensagens`). Por isso funções e trigger do NÚCLEO levam prefixo `nucleo_` e a migration não semeia todos os `auth.users`. **Atenção fase 3:** `public.leads` já existe (outro sistema); o pipeline do NÚCLEO vai precisar de outro nome ou schema.
- 2026-11-12 — TS strict + `noUncheckedIndexedAccess`. Vitest com `TZ=UTC` para garantir que os testes de fuso não dependam da máquina.

## Bloqueios
- 2026-11-12 — **0.4/0.5:** projeto definido (`tarulbqnnbqdrvwsphcw`), mas o conector não tem acesso a ele e a connection string não chegou ao `.env.local`. Peter roda o SQL pelo SQL Editor. Aguardando: resultado de `supabase/verificacao.sql` → aprovação da lista de exclusão → aplicar migration → criar usuário + template OTP com `{{ .Token }}`.
- 2026-11-12 — **0.8: deploy na Vercel não feito.** Depende do Supabase (sem as variáveis o app responde 503 em tudo menos `/login`) e de OK do Peter para publicar. Também falta remoto no GitHub para o CI (`.github/workflows/ci.yml` já pronto) rodar.

## Configuração pendente com o Peter
- [ ] Marco inicial (título, métrica, valor alvo)
- [ ] Faturamento atual da ARTe (para o primeiro estado do marco)
- [ ] Ticket médio de contrato e taxas de conversão estimadas
- [ ] Lista de hábitos
- [ ] Princípios diários
- [ ] Meta diária de horas de foco

## Log de sessões
| data | fase.tarefa | o que foi feito / observações |
|---|---|---|
| 2026-11-12 | 0.1 | Next.js 16 + TS strict + ESLint + Tailwind 4; estrutura de pastas do §3 com páginas placeholder; scripts typecheck/lint/test; git init. |
| 2026-11-12 | 0.2 | Unbounded (next/font/google) + Geist/Geist Mono (pacote geist); tokens Obsidiana Volt em `:root` e mapeados no `@theme` do Tailwind 4 (paleta, escala tipográfica, raios, glows; cores/sombras padrão do Tailwind removidas para impedir valores fora do DS); utilitários `.num` e `.label-instrument`. |
| 2026-11-12 | 0.3 | Button, HudCard (variant target), StatTile, Chip, GridBackground, TabBar (mobile), Sidebar (desktop ≥ lg), PageHeader/EmptyState; layout `(app)` + página "Mais" no mobile; Comando vazio já com a identidade. Verificado em 375×812 e 1366×800. |
| 2026-11-12 | 0.4 (parcial) | Clients `lib/supabase/{client,server,admin}.ts` (`admin` com `server-only`), `proxy.ts` com refresh de sessão e proteção de `(app)`, login OTP em 2 passos, `/auth/signout`, `.env.example`. Aguardando criação do projeto Supabase (ver Bloqueios). |
| 2026-11-12 | 0.5 (parcial) | `supabase/migrations/20261112190000_init.sql`: enums, `settings`, `principles`, `categories`, `inbox_messages`, trigger `updated_at`, RLS (4 políticas por tabela), seed por usuário. Validado em PGlite com `auth` simulado. Falta aplicar no projeto real (ver Bloqueios). |
| 2026-11-12 | 0.6 | `lib/money.ts` (centavos inteiros, `parseBRL` pt-BR sem float, `formatBRL`, `brlParts`), `lib/dates.ts` (datas ISO de calendário, hoje/hora/meia-noite em SP, mês, semana seg–dom), `lib/metrics/business-days.ts` (workdays + feriados opcionais). 48 testes com TZ=UTC cobrindo virada de dia/mês/ano em SP, 29/02 e fim de semana. |
| 2026-11-12 | 0.7 (parcial) | `app/manifest.ts` (standalone, #05060A), ícones 180/192/512 + maskable + SVG, splash 1125×2436 (iPhone 11 Pro), meta iOS `black-translucent`, Serwist (`app/sw.ts` + `SerwistProvider`). Build ok; manifest/SW servidos com 200 no `next start`. O navegador embutido não registra SW nenhum (nem um trivial), então o teste real fica para o iPhone com HTTPS, após o deploy (0.8). |
| 2026-11-12 | 0.8 (parcial) | CI em GitHub Actions (Node 24: `npm ci` → typecheck → lint → test). Local: typecheck/lint ok, 48 testes passando. Deploy pendente (ver Bloqueios). |
