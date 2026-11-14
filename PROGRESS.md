# PROGRESS.md — NÚCLEO

> Leia este arquivo no início de toda sessão. Marque `[x]` ao concluir cada tarefa,
> registre decisões e escreva uma linha no Log. Uma fase só termina quando todos os critérios de aceite passam.

**Fase atual:** 2 (Fase 1 com a 1.9 aguardando configuração — ver Bloqueios)
**Próxima tarefa:** 2.2 rodar a bateria do parser (sem crédito na OpenAI — ver Bloqueios), depois 2.6

---

## Fase 0 — Fundação
- [x] 0.1 Criar projeto Next.js (App Router, TS strict, ESLint, Tailwind) + estrutura de pastas do ARCHITECTURE.md §3
- [x] 0.2 Instalar fontes (Unbounded, Geist, Geist Mono) e tokens do DESIGN.md §2–4 em `globals.css` + `tailwind.config`
- [x] 0.3 Componentes base: `Button`, `HudCard`, `StatTile`, `Chip`, `GridBackground`, `TabBar`, sidebar desktop
- [x] 0.4 Projeto Supabase + clients (server/client/admin) + Auth por e-mail OTP + middleware protegendo `(app)`
- [x] 0.5 Migration inicial: `settings`, `principles`, `categories` (com seed), `inbox_messages` + RLS + trigger `updated_at`
- [x] 0.6 `lib/money.ts` e `lib/dates.ts` (fuso SP) + `business-days.ts` com testes
- [x] 0.7 PWA: manifest, ícones, Serwist, splash; testar "Adicionar à Tela de Início" no iPhone
- [x] 0.8 Deploy na Vercel com variáveis de ambiente; CI rodando typecheck + lint + test

**✅ Fase 0 concluída em 2026-11-12.** **Critérios de aceite:** login funciona no iPhone e no PC · app instalado abre em tela cheia · tela vazia já tem a identidade visual (grade, tab bar, fontes) · testes passando.

---

## Fase 1 — Dinheiro + Marcos + Captura (o MVP que precisa ser usado todo dia)
- [x] 1.1 Migrations: `transactions`, `milestones` + views `v_month_totals`, `v_category_breakdown`
- [x] 1.2 `lib/metrics/pace.ts` (ARCHITECTURE §6.1) com testes de borda
- [x] 1.3 `/api/ingest`: auth por token, parser OpenAI com `add_transaction`, `query`, `undo_last`, `ask_clarification`; log em `inbox_messages`
- [x] 1.4 Fixtures de parser (mín. 15 frases de dinheiro) + teste
- [x] 1.5 Tela **Comando** v1: anel do marco, ticker, faltam R$ X, barra de ritmo, projeção (Realtime atualiza ao lançar)
- [x] 1.6 `CaptureButton` (texto) + `CommandPalette` (Ctrl/Cmd+K) usando `/api/ingest`
- [x] 1.7 Tela **Dinheiro**: extrato, filtros (mês/categoria), edição inline, relatórios do mês e 12 meses
- [x] 1.8 Tela **Marcos**: criar/ordenar marcos, linha do tempo de conquistas, celebração ao bater
- [ ] 1.9 WhatsApp **em código, sem n8n**: Evolution → webhook `/api/whatsapp` → filtro de número → (áudio → STT) → pipeline do ingest → resposta via Evolution. Passo a passo em `integrations/whatsapp/README.md` — **código pronto**, falta configurar a Evolution e as variáveis na Vercel
- [x] 1.10 Resposta de receita sempre com o novo estado do marco (ARCHITECTURE §5.2)

**Critérios de aceite:** mando "recebi 1500 do cliente X" por áudio no WhatsApp e em < 10s recebo a confirmação com o marco atualizado · o anel no app sobe sozinho · "desfaz" reverte · relatório do mês bate com a soma manual.

---

## Fase 2 — Rotina: tarefas, hábitos, tempo, briefings, Siri e widget
- [x] 2.1 Migrations: `tasks`, `habits`, `habit_logs`, `time_entries`, `daily_reviews`, `goals`, `recurring_rules`, `push_subscriptions` + `v_habit_streaks`
- [ ] 2.2 Ferramentas do parser: `add_task`, `complete_task`, `log_habit`, `start_timer`, `stop_timer`, `log_time` + fixtures — **código e fixtures prontos**, falta rodar `npm run test:parser` (OpenAI sem crédito)
- [x] 2.3 Tela **Rotina** (abas Tarefas · Hábitos com heatmap · Tempo)
- [x] 2.4 Tela **Objetivos** (trimestre, área, porquê, métrica, tarefas vinculadas)
- [x] 2.5 `lib/metrics/score.ts` + faixa "Hoje" e top 3 tarefas no Comando + princípio do dia
- [ ] 2.6 Endpoints `/api/cron/briefing-manha` e `/api/cron/fechamento-dia` (números no servidor, texto pela OpenAI) + agendamento no Vercel Cron
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
- [ ] 3.8 Receita vinculada a lead (`lead_id`) e marco `mrr`

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
- ~~2026-11-12 — Pessoal e ARTe juntos, diferenciados por `scope`.~~ **Substituída:** não existe ARTe no NÚCLEO. O Peter é autônomo (serviços como PJ, sem CNPJ, sem planos de agência) e vê o app como 100% desenvolvimento pessoal: **um dinheiro só, sem `scope`**. Custo do trabalho sai das categorias. Métricas de marco: `revenue_month`, `revenue_cumulative`, `mrr`, `net_month`. Migration `20261112230000_remove_scope.sql`; ARCHITECTURE e DESIGN atualizados.
- ~~2026-11-12 — Lógica de negócio no código; n8n apenas como ponte de WhatsApp/áudio e agendador.~~ **Substituída em 2026-11-13:** sem n8n (escolha do Peter, "vou fazer tudo em código").
- 2026-11-12 — Dark-only, design system "Obsidiana Volt".
- 2026-11-12 — Raiz do repositório = pasta `JARVIS` (equivale a `nucleo/` do ARCHITECTURE §3); docs renomeados de `CLAUDE (1).md`/`ARCHITECTURE (1).md` para os nomes canônicos.
- 2026-11-12 — Next.js 16.4 (template atual): `middleware.ts` passa a se chamar `proxy.ts`; Tailwind v4 configurado via CSS (`@theme` em `globals.css`), sem `tailwind.config.ts`.
- 2026-11-12 — `cacheComponents`/`partialPrefetching` desligados: app é 100% autenticado e dinâmico (single-user), o modelo de Suspense obrigatório só adicionaria complexidade.
- 2026-11-12 — **Login só com senha** (pedido do Peter: "não quero ficar colocando e-mail"). Substitui o e-mail OTP do ARCHITECTURE §2/0.4. Server action chama `signInWithPassword` com o e-mail do dono vindo de `NUCLEO_OWNER_EMAIL` (só servidor); a tela tem um campo só. Sessão persiste por aparelho. Senha definida via `supabase/definir_senha.sql`. Dispensa SMTP/template de e-mail.
- 2026-11-12 — `proxy.ts` falha fechado: sem variáveis do Supabase responde 503 em tudo menos `/login`. `/api/*` fica fora do matcher (autentica por token).
- 2026-11-12 — Seed de `settings` + categorias por **trigger em `auth.users`** (`seed_user_defaults`), pois numa migration não existe `auth.uid()`. A migration também semeia usuários já existentes. Funções `security definer` com `search_path = ''` e `execute` revogado de anon/authenticated.
- 2026-11-12 — PWA com `@serwist/turbopack` (o `@serwist/next` exige webpack; Next 16 builda com Turbopack). SW servido por route handler em `/serwist/sw.js`, desligado em dev. `/api`, `/auth` e Supabase sempre `NetworkOnly`. Ícones gerados por `scripts/generate-icons.mjs` (N geométrico em paths, sem depender de fonte instalada).
- 2026-11-12 — Banco: projeto Supabase **existente** do Peter (`tarulbqnnbqdrvwsphcw`), compartilhado com outros sistemas (schema `prospector`, `public.leads/conversas/mensagens`). Por isso funções e trigger do NÚCLEO levam prefixo `nucleo_` e a migration não semeia todos os `auth.users`. **Atenção fase 3:** `public.leads` já existe (outro sistema); o pipeline do NÚCLEO vai precisar de outro nome ou schema.
- 2026-11-12 — Vercel: projeto `nucleo` (conta pertso402), produção em https://nucleo-beta.vercel.app. `vercel.json` fixa framework Next.js (o projeto criado pelo CLI veio como "Other" e só publicava `public/`) e região `gru1` (São Paulo, perto do Supabase sa-east). Node fixado em 24.x via `engines`. Variáveis em produção: URL e chave publicável do Supabase + `NUCLEO_OWNER_EMAIL`.
- 2026-11-12 — Código em repositório privado https://github.com/pertso402/NUCLEO (branch `main`). CI do GitHub Actions roda em todo push, e a Vercel está conectada ao repositório: **todo push na `main` publica em produção** automaticamente.
- 2026-11-12 — Ritmo (`pace.ts`): `paceNeeded` arredonda para cima e `paceCurrent` para baixo (nunca promete mais do que tem); projeção numa conta só (`current × bdTotal ÷ bdElapsed`) para não acumular arredondamento; mensagens em reais cheios arredondados para cima. Também expõe `expectedPct` (onde deveria estar hoje) para o tick do anel e a barra de ritmo (DESIGN §5).
- 2026-11-13 — **1.5 adiantada antes de 1.3/1.4** (pedido do Peter). A 1.3 depende de chaves (Anthropic, `service_role`, token) que ainda não foram providenciadas; a 1.5 só lê o banco. O Realtime da 1.5 já fica pronto, então quando a 1.3 entrar o anel sobe sozinho.
- 2026-11-13 — Vitrine `/dev/comando` (só em `next dev`, 404 em produção, sem login) mostra o hero nos estados zero/abaixo/no ritmo/batido com dados fictícios — o login real não pode ser automatizado (senha do Peter). O anel não anima o arco (DESIGN: animar só transform/opacity); quem anima é o número (ticker).
- 2026-11-13 — **OpenAI no lugar da Claude API** para parsing e briefings (escolha do Peter). Modelos configuráveis por variável (`OPENAI_MODEL`, `OPENAI_MODEL_FALLBACK`, `OPENAI_MODEL_BRIEFING`) para trocar sem mexer no código. CLAUDE.md, ARCHITECTURE §2/§5.2/§8/§11 atualizados.
- 2026-11-13 — Ingest: modelo `gpt-5.4-mini` (fallback `gpt-5.5`) via Chat Completions com function calling `strict`; `reasoning_effort` não é aceito com ferramentas nesse modelo, fica no padrão. Valor chega como texto e o servidor converte com `parseBRL` (sem float). Dono resolvido pela única linha de `settings` (projeto compartilhado). `/api/ingest` aceita `x-nucleo-token` (n8n/Siri) **ou** a sessão do dono (botão de captura e palette, Fase 1.6). Rate limit em memória por instância (freio, não garantia).
- 2026-11-13 — Bateria do parser (`npm run test:parser`, config `vitest.parser.config.ts`) roda contra a OpenAI real e fica **fora do CI** (precisa de chave e gasta API). Rodar sempre que mudar prompt, modelo ou categorias. Data fixa nas fixtures (13/11/2026 12h SP) para "ontem" ser determinístico.
- 2026-11-13 — Captura no app sem emoji (DESIGN §7): a resposta do ingest continua com emoji para o WhatsApp e `lib/ingest/reply-lines.ts` converte cada linha em tipo → ícone Lucide; a dica "desfaz" vira botão **Desfazer**. Botão flutuante só no mobile (no desktop é Ctrl/⌘+K e o botão "Lançar" na sidebar). Gravação de áudio no botão continua na 2.10.
- 2026-11-13 — **Sem n8n.** A Evolution chama `/api/whatsapp` direto; o app filtra, transcreve, roda `runIngest` e responde via Evolution `sendText`. O webhook responde 200 na hora e processa com `after()` (a Evolution não reenvia por demora). Agendamentos da Fase 2 vão para Vercel Cron (UTC: 07:30 SP = 10:30 UTC; no plano Hobby o cron é no máximo diário e com folga de horário — reavaliar na 2.6). CLAUDE.md e ARCHITECTURE §1/§3/§5/§8 atualizados. O fluxo n8n feito antes (commit 592890f) foi removido.
- 2026-11-13 — `/api/whatsapp` aceita o token em `x-nucleo-token` **ou** `?token=` na URL, porque a tela de webhook da Evolution nem sempre deixa configurar header (HTTPS, comparação em tempo constante). Número autorizado em `PETER_WHATSAPP_NUMBER` e modo em `WHATSAPP_MODE`; `settings.whatsapp_number` fica para os briefings.
- 2026-11-13 — Transcrição: ElevenLabs Scribe (`scribe_v2`, `por`) se houver `ELEVENLABS_API_KEY`; senão OpenAI (`gpt-4o-mini-transcribe`, `OPENAI_STT_MODEL`), que já está configurada — assim o áudio funciona sem chave nova. Falha de transcrição não gera linha em `inbox_messages` (não houve texto); fica no log da Vercel com prefixo `whatsapp:`.
- 2026-11-13 — Filtro do WhatsApp: compara o número sem o 9 do celular BR (o WhatsApp às vezes omite), resolve `@lid` por `remoteJidAlt`/`senderPn`, ignora grupos/status/canais, descarta mensagens com mais de 5 min (reenvio da Evolution ao reconectar) e as próprias respostas (começam com U+2063, para não entrar em loop se a instância for o número do Peter — modo `meu_numero`) e o mesmo evento entregue duas vezes (memória de 10 min por instância).
- 2026-11-13 — Áudio: preferir "Webhook Base64" ligado na Evolution (o `getBase64FromMediaMessage` falha com áudio do iPhone em algumas versões); o app só baixa se o base64 não vier. A resposta de áudio ecoa a transcrição (🎙️ "…") para o Peter conferir e mandar "desfaz" se errou.
- 2026-11-13 — Fase 2 iniciada com a 1.9 só faltando configuração (variáveis da Evolution na Vercel + webhook), a pedido do Peter ("depois configuramos"). Os critérios de aceite da Fase 1 ficam para quando o WhatsApp estiver ligado.
- 2026-11-13 — 2.1: `lead_id` em `tasks`, `time_entries` e `recurring_rules` sem FK até a Fase 3 (mesmo motivo de `transactions`: `public.leads` é de outro sistema). `weekly_reviews` entrou já na 2.1 (mesma família de `daily_reviews`, usada na 2.7). `tasks.source` reaproveita o enum `capture_channel`. `recurring_rules.last_generated_on` evita lançamento duplicado na 2.11. `goals.position` para ordenar. Trigger `nucleo_check_habit_owner` impede marcar hábito de outro usuário.
- 2026-11-13 — `v_habit_streaks`: hábito diário (`target_per_week = 7`) conta dias seguidos e continua vivo se o último dia marcado foi hoje ou ontem; hábito com meta semanal menor conta semanas (seg–dom) que bateram a meta e a semana em andamento não quebra a sequência. "Hoje" em America/Sao_Paulo. Coluna `unit` (`day`/`week`) diz qual.
- 2026-11-13 — 2.2: o parser recebe hábitos ativos, até 40 tarefas abertas, objetivos ativos, o timer rodando e o calendário dos próximos 7 dias ("sexta" = próxima sexta depois de hoje), para não errar conta de data. Tarefa/hábito/objetivo são resolvidos no servidor por nome (`lib/ingest/match.ts`: igual → contém → palavras em comum; empate = pergunta qual). `lead_ref` fica para a Fase 3 (sem tabela de leads ainda).
- 2026-11-13 — Rotina pelo ingest: prazo no passado vira hoje; hábito/tempo com data futura vira hoje; hábito já marcado no dia responde "já estava marcado" sem erro; iniciar timer com outro rodando fecha o anterior; `log_time` de outro dia termina às 18h daquele dia; parar o timer mostra o foco total do dia. O "desfaz" agora apaga o que foi criado (lançamentos, tarefas, hábitos, tempo) e restaura o que foi alterado (`result.updated` com o estado anterior), nessa ordem — o timer novo sai antes de reabrir o anterior.
- 2026-11-13 — Tela Rotina (2.3): cada aba é uma URL (`/rotina?aba=habitos|tempo`) e só carrega os dados dela. Criar/editar/arquivar hábito fica na própria aba Hábitos (Ajustes ainda não existe e sem isso a aba seria inútil). Tarefa "descartada" vira `dropped` (some sem apagar). Marcar tarefa/hábito é otimista (`useOptimistic`). Mapa de 12 semanas agrega todos os hábitos (intensidade = feitos/ativos no dia); cada hábito tem os últimos 7 dias clicáveis e a sequência atual/recorde (Gold quando a atual é o recorde, DESIGN §2). Tempo usa Plasma (botão `variant="focus"` novo no `Button`); horas por rótulo somam sem diferenciar maiúsculas. Realtime global agora também ouve `tasks`, `habit_logs`, `time_entries`.
- 2026-11-13 — Tela Objetivos (2.4): trimestre pela URL (`?tri=2027-Q1`), agrupada por área; métrica é número livre (não dinheiro — dinheiro tem os marcos), digitada em pt-BR (`parseDecimal`) com +1/−1 rápido; barra em Plasma com a marca de "onde deveria estar hoje" pelo tempo do trimestre (no ritmo = Volt, abaixo = Ember, igual à barra de ritmo do marco). Tarefas criadas no card já nascem vinculadas (`goal_id`). Concluído não é riscado (só "deixado de lado").
- 2026-11-13 — Score do dia (2.5), interpretação do §6.2: "planejadas" = tarefas que mexem faturamento com prazo até hoje (abertas + concluídas hoje), máx. 3 no denominador; sem nenhuma planejada, concluir alguma vale cheio e não concluir vale zero (incentiva planejar). Componente sem dado sai e os pesos se redistribuem — **abordagens fica de fora até a Fase 3** (sem `leads`/`outreach_logs`). Hábitos previstos hoje = diários + semanais que ainda não bateram a meta da semana (sem contar hoje). Fim de semana segue `settings.workdays`. Score é calculado ao vivo; gravar em `daily_reviews` fica com o fechamento do dia (2.6/2.7).
- 2026-11-13 — Princípio do dia roda por data (mesmo princípio o dia todo). Sem princípios cadastrados, mostra o lema do NÚCLEO e um "+ princípio" no próprio card (Ajustes ainda não existe). Não inventei princípios pelo Peter.
- 2026-11-13 — Tela Dinheiro: filtros (mês, tipo, categoria) vivem na URL (`?mes=2026-11&tipo=expense&cat=<id>`), então dá pra voltar/compartilhar o estado. Totais e relatórios usam só `confirmed` (mesma regra das views); o extrato mostra também `pending_review` com chip "revisar" e botão Confirmar por linha (a revisão em lote continua na 4.4). Edição/exclusão por server actions com a sessão do dono (RLS), valor como texto pt-BR → `parseBRL`; excluir pede confirmação em 2 toques. Receita acumulada é **dia a dia no mês**, com a meta do marco `revenue_month` do mês como linha tracejada. Categorias em barras horizontais simples (sem Recharts) que filtram o extrato ao tocar. Recharts 3.
- 2026-11-13 — **Visual v2 "Neon"** (pedido do Peter: mais cyberpunk, mais luz e brilho, menos quadrado, menos apagado). Fundo com luzes de neon difusas que derivam, linhas de varredura e horizonte de luz; cards de vidro com filete de luz; raios maiores e chips em pílula; texto neon nos números de receita/progresso; anel em estilo gauge (escala de 60 marcas, ponto de luz na ponta); doca de vidro flutuante; gráficos com glow. Documentado no DESIGN.md (v2). Desfoque só em poucos elementos por tela (extrato sem desfoque) por causa do iPhone 11 Pro; luzes do fundo são gradientes (sem `filter: blur`) animando só `transform`.
- 2026-11-13 — **Navegação instantânea** (Peter sentia atraso ao trocar de aba). Causa: cada aba esperava o servidor montar a página inteira (com consultas ao Supabase) antes de trocar. Correções: `app/(app)/loading.tsx` (esqueleto aparece na hora), aba acende no toque (`useOptimisticPath`), `prefetch` completo nas abas/sidebar (página com dados já baixada em segundo plano), cache do router (`experimental.staleTimes` 300s), entrada de tela de 180ms só com opacity/transform, `active:scale` em tudo que é tocável. Para o cache não mostrar dado velho, um **único `RealtimeRefresh` no layout** escuta `transactions`/`milestones` e chama `router.refresh()` (que descarta o cache) a cada mudança; as server actions também revalidam. Medido em dev: aba acende em 8 ms; voltar a uma aba visitada 22–78 ms (antes ~1,3 s). A sessão no `proxy.ts` já é validada localmente (`getClaims` com chave ES256).
- 2026-11-13 — **Marco batido é detectado no código** (`syncAchievements` em `lib/data/milestone.ts`), não por trigger no banco: roda depois de toda mudança em lançamentos ou marcos (ingest, ações da tela Dinheiro, ações da tela Marcos). Assim a regra de valor fica num lugar só (a mesma do anel) e não precisa de migration. `mrr` nunca bate até a Fase 3. Desfazer um lançamento **não** desfaz a conquista; para isso existe "Reabrir" na linha do tempo. Só marcos ativos podem ser arquivados (arquivar um batido apagaria a data, por causa da constraint `achieved_has_date`).
- 2026-11-13 — Celebração aparece em qualquer tela (fica no layout) para conquistas dos últimos 7 dias, **uma vez por aparelho** (ids vistos em `localStorage`), sem coluna nova no banco. Reordenar a fila é por ↑/↓ (arrastar no celular é frágil); o 1º da fila é o destaque do Comando. Marcos mensais escolhem um mês ou "todo mês"; acumulados têm prazo opcional (o ritmo conta de hoje até o prazo).
- 2026-11-12 — TS strict + `noUncheckedIndexedAccess`. Vitest com `TZ=UTC` para garantir que os testes de fuso não dependam da máquina.

## Bloqueios
- 2026-11-13 — **OpenAI sem crédito** ("429 You have no credits remaining"): o parser não funciona — lançar pelo app (e pelo WhatsApp, quando ligado) responde erro até o Peter colocar crédito em platform.openai.com → Billing. Bloqueia rodar a bateria da 2.2.
- 2026-11-13 — **1.9 ativação:** depende do Peter/das credenciais: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `PETER_WHATSAPP_NUMBER` (e opcionalmente `WHATSAPP_MODE`, `ELEVENLABS_API_KEY`) na Vercel, e o webhook da instância apontando para `/api/whatsapp?token=…` (passo a passo em `integrations/whatsapp/README.md`). Depois: teste real e critérios de aceite da Fase 1.

## Configuração pendente com o Peter
- [x] Marco inicial: **"R$ 10k de receita"** · métrica `revenue_month` · alvo R$ 10.000 (1.000.000 centavos) · período nov/2026, prazo 30/11/2026 (entra como seed na 1.1)
- [ ] Receita que já entrou em nov/2026 (para o anel começar no lugar certo; vira lançamentos na 1.1)
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
| 2026-11-12 | 0.4/0.5 | Limpeza dos sistemas chapelao_/arte_ no Supabase compartilhado (aprovada pelo Peter, inclusive tabelas com dados). Migration inicial aplicada (tabelas confirmadas via API). Usuário criado. Login trocado para senha única (sem e-mail na tela); testado contra o Supabase real (senha errada → "Senha incorreta."). Falta o Peter definir a senha e entrar. |
| 2026-11-12 | 0.4/0.5 ✓ | Peter definiu a senha e entrou; logs do dev mostram as rotas protegidas respondendo 200 com sessão. Checagem completa de gatilhos (`supabase/checar_migration.sql`) não foi rodada; tabelas e RLS confirmados via API. |
| 2026-11-12 | 0.8 (deploy ✓) | Publicado em https://nucleo-beta.vercel.app. Verificado: `/` e rotas protegidas → 307 para `/login`; `/login` 200; manifest, `/serwist/sw.js` (com `Service-Worker-Allowed: /`), ícones e splash 200; tela de login renderiza no mobile. Primeira publicação deu 404 (framework "Other"), corrigido com `vercel.json`. |
| 2026-11-12 | 0.7 ✓ | Peter instalou pelo Safari no iPhone 11 Pro: abre em tela cheia, login ok. Critérios de aceite da Fase 0 conferidos: login no iPhone e no PC ✓ · app instalado em tela cheia ✓ · identidade visual na tela vazia ✓ · 48 testes passando (local) ✓. Pendente só o CI rodar no GitHub. |
| 2026-11-12 | 0.8 ✓ · Fase 0 ✓ | Push para github.com/pertso402/NUCLEO; CI #1 (typecheck + lint + 48 testes) passou em 1m21s. Todos os critérios de aceite da Fase 0 conferidos. |
| 2026-11-12 | pré-1.1 | Removida a separação arte/pessoal de tudo (código, banco via nova migration, ARCHITECTURE, DESIGN, PROGRESS); SQLs de limpeza já usados removidos do repo. Marco inicial definido: R$ 10k de receita em nov/2026. Vercel conectada ao GitHub. |
| 2026-11-12 | pré-1.1 ✓ | Migration `remove_scope` aplicada pelo Peter; confirmado via API (`categories.scope_default` não existe mais). |
| 2026-11-12 | 1.1 ✓ | Migration `20261112235000_money_milestones.sql`: `transactions` (centavos > 0, source, status, `external_id` único por usuário), `milestones` (métricas sem scope), views `v_month_totals` e `v_category_breakdown` com `security_invoker` (respeitam RLS; só `confirmed`), Realtime ligado nas duas tabelas, marco "R$ 10k de receita" (nov/2026) semeado só para quem tem `settings`. Testada em PGlite (totais, isolamento entre usuários, valor negativo recusado) e aplicada pelo Peter; confirmada via API. `lead_id` sem FK até a Fase 3 (conflito de nome com `public.leads`). |
| 2026-11-12 | 1.2 ✓ | `lib/metrics/pace.ts` (§6.1): dias úteis decorridos contam hoje só após 12h em SP, `bdLeft` mínimo 1, projeção, `etaDate`, textos "No ritmo"/"Abaixo do ritmo"/"Marco batido", `resolvePeriod` (null = mês corrente). 13 testes: zero no meio do mês, no ritmo, manhã × tarde, batido, meta zero, virada de mês às 23h, primeiro dia, feriado. Total 61 testes. |
| 2026-11-13 | 1.5 ✓ | Comando v1: `RingProgress` (arco Volt com glow, tick Ember/Volt de "onde deveria estar", Gold só no batido), `StatTicker` (600ms, respeita reduced-motion), `PaceBar`, `Money` (R$ 50%/centavos apagados), `MilestoneHero` (faltam, dias úteis, precisa × ritmo por dia, resumo), `lib/data/comando.ts` (marco ativo de menor `position` + soma dos lançamentos confirmados) e `lib/metrics/milestone-value.ts` (6 testes). `RealtimeRefresh` re-renderiza ao mudar `transactions`/`milestones` e ao voltar o foco. Saudação por hora e data em SP. Verificado em 375×812 e 1366×900 pela vitrine. Total 67 testes. |
| 2026-11-13 | 1.5 ✓ (validada) | Peter abriu o app publicado e o Comando mostrou o marco de R$ 10k com os dados reais. |
| 2026-11-13 | 1.3 ✓ | `/api/ingest` + `lib/ingest/{tools,parser,executor,run}.ts`: token em tempo constante, rate limit 30/min, inbox registrado antes de processar, `add_transaction` (categoria por nome sem acento, fallback Outros/Outras receitas, data relativa), `query` (marco, resumo do mês, total por categoria — números do SQL), `undo_last` (reverte a última captura e marca `undone`), `ask_clarification` (próxima mensagem do canal em 10 min vira resposta). Resposta no formato §5.2 com o marco a cada receita. Teste de ponta a ponta no banco real: 401 sem token, receita/2 despesas/consulta/desfaz×2/esclarecimento → todos certos, 2–6 s por frase; registros de teste apagados. 10 testes unitários novos (77 no total). |
| 2026-11-13 | 1.3 (produção) | `/api/ingest` publicado: 401 sem token; consulta do marco com token respondeu em 4,5 s com os números certos (registro de teste apagado). |
| 2026-11-13 | 1.4 ✓ | `tests/fixtures/ingest.json`: 24 frases (18 de dinheiro, incluindo 2 lançamentos numa frase, "ontem", "2,5 mil", "1,5k", "60 conto", "1.200"; + desfaz ×2, 3 consultas, 1 dúvida). Primeira rodada 22/24 (categoria de internet e farmácia) → dicas de categoria no prompt. A bateria achou um bug real: o modelo manda "99 reais" e o `parseBRL` não aceitava a palavra — corrigido (reais/real/conto/pila) com 6 testes novos. Depois: 24/24 em duas rodadas seguidas. 83 testes unitários. |
| 2026-11-13 | 1.6 ✓ | `CaptureProvider` (estado, Ctrl/⌘+K, envio para `/api/ingest` com a sessão, `router.refresh()`), `CommandPalette` (folha de baixo no mobile, central no desktop, histórico da sessão, "Processando…", Desfazer, Esc, foco automático, input 16px pra não dar zoom no iOS), `CaptureButton` 56px acima da tab bar, botão "Lançar" na sidebar, `ReplyView` + `reply-lines` (4 testes). Vitrine `/dev/captura`. Verificado 375×812 e 1366×900; sessão real autentica (200) e sem cookie dá 401 — uma despesa de teste de R$ 1 criada sem querer nessa checagem foi apagada. 87 testes. |
| 2026-11-13 | 1.7 ✓ | Tela Dinheiro: resumo receita/despesa/saldo, receita acumulada (área Volt + meta tracejada), extrato por dia com ícone da origem, filtros tipo/categoria, edição inline (tipo, valor, data, categoria, descrição, cliente/loja), confirmar pendente, excluir com confirmação; categorias por tipo; 12 meses em barras (Volt × Flare). `lib/metrics/money-report.ts` + `addMonths`/`parseMonthKey`/rótulos de mês + `centsToInput`/`formatCompactBRL` (12 testes novos, 99 no total). `DinheiroView` separado da página para a vitrine `/dev/dinheiro` (dados fictícios). Verificado 375×812 (sem rolagem horizontal) e desktop; página real abre com os dados do banco (vazio, meta R$ 10k). Nenhuma edição real feita na checagem. |
| 2026-11-13 | visual v2 + navegação | Visual "Neon" (DESIGN.md v2): tokens de vidro/glow, `GridBackground` com luzes, `HudCard` de vidro com `accent`, anel gauge, doca flutuante, sidebar com item aceso, chips em pílula, botões e captura com glow, gráficos com glow. Navegação: esqueleto `loading.tsx`, aba otimista, prefetch completo, `staleTimes`, Realtime global no layout, transição de 180ms. Verificado em 375×812 (Comando e Dinheiro, dados reais e vitrine). 99 testes, build ok. |
| 2026-11-13 | 1.8 ✓ | Tela Marcos ("A escada"): marco em destaque, fila com progresso de cada marco, ↑/↓ para reordenar, criar/editar inline (nome, métrica, meta, mês ou prazo), arquivar; linha do tempo de conquistas em dourado (data + quantos dias levou, Reabrir); arquivados com voltar pra fila / excluir de vez. `syncAchievements` marca o marco como batido no ingest e nas ações; resposta do WhatsApp ganha a linha 🏆. Celebração em tela cheia (anel Gold, partículas em canvas ≤ 60 por 1,6s, "Próximo marco →"). `lib/metrics/milestones.ts` (10 testes) + teste do `syncAchievements` com Supabase falso (2). 111 testes, build ok. Verificado em 375×812 (vitrine `/dev/marcos` e página real, só leitura). |
| 2026-11-13 | 1.10 ✓ | Já entregue: desde a 1.3 toda receita responde com o estado do marco em destaque; agora, se a receita bater o marco, vem `🏆 Marco "X" batido! R$ … em N dias` e em seguida o estado do próximo marco. |
| 2026-11-13 | 1.9 (parcial) | Fluxo n8n `nucleo-whatsapp.json` (webhook → Config → filtro → áudio: base64 do webhook ou download na Evolution → ElevenLabs Scribe → `/api/ingest` → resposta via Evolution `sendText`), README com instalação, 16 testes dos nós Code. Produção confirmada: token certo passa da autenticação (teste com payload inválido, nada gravado). Falta o Peter importar/ativar. 127 testes. |
| 2026-11-13 | 1.9 (código) | Trocado o n8n por código, a pedido do Peter: `app/api/whatsapp` (token, 200 imediato, `after()`), `lib/whatsapp/{webhook,evolution,stt,handle}.ts`, guia em `integrations/whatsapp/README.md`; fluxo n8n removido; docs sem n8n (cron → Vercel Cron). 22 testes (filtro, resposta, áudio com/sem base64, falhas, limite, duplicata). Falta configurar Evolution/variáveis e testar de verdade. |
| 2026-11-13 | 2.1 (parcial) | Migration `20261113220000_routine.sql`: `goals`, `tasks`, `habits`, `habit_logs`, `time_entries` (1 timer aberto por usuário), `daily_reviews`, `weekly_reviews`, `recurring_rules`, `push_subscriptions` + RLS, `updated_at`, `v_habit_streaks`, Realtime em tasks/habit_logs/time_entries. Validada em PGlite com todas as migrations: 27 checagens (constraints, RLS entre dois usuários, sequências diária/semanal). Não aplicada (ver Bloqueios). |
| 2026-11-13 | 2.1 ✓ | Peter aplicou a migration pelo SQL Editor do projeto do NÚCLEO (a primeira tentativa foi em outro projeto e foi desfeita pelo próprio Supabase; ERP-CHAPELAO e CARDAPIOS conferidos limpos). Conferido via API: as 9 tabelas e `v_habit_streaks` respondem com a service role; sem login, tudo vem vazio (RLS). |
| 2026-11-13 | 2.2 (código) | Ferramentas `add_task`, `complete_task`, `log_habit`, `start_timer`, `stop_timer`, `log_time` (`lib/ingest/{tools,routine,match}.ts`), contexto de rotina no prompt (`loadRoutineState` em `run.ts`), desfaz com restauração. 23 testes novos com Supabase em memória (`tests/unit/helpers/fake-supabase.ts`); +14 frases de rotina nas fixtures (38 no total). Bateria real não rodou: OpenAI sem crédito. 156 testes. |
| 2026-11-13 | 2.3 ✓ | Tela Rotina: abas Tarefas (Hoje · Semana · Backlog, adicionar rápido com prazo e "mexe no faturamento", concluir/reabrir, editar, descartar), Hábitos (mapa de 12 semanas, últimos 7 dias clicáveis, sequência/recorde, criar/editar/arquivar) e Tempo (timer ao vivo, foco do dia × meta, 7 dias, horas por rótulo, lançar e apagar registros). `lib/metrics/routine.ts` (9 testes), `lib/data/routine.ts`, `app/(app)/rotina/actions.ts`, vitrine `/dev/rotina`. Conferido em 375×812 e desktop com dados fictícios; consultas da tela rodadas no banco real (só leitura). A sessão local tinha expirado, então a tela com login não foi aberta. 165 testes, build ok. |
| 2026-11-13 | 2.4 ✓ | Tela Objetivos: navegação por trimestre (dia X de 92), objetivos por área com porquê, data alvo, métrica com +1/−1 e ritmo contra o trimestre, tarefas vinculadas (marcar e adicionar no card), concluir/deixar de lado/reabrir, criar/editar. `lib/metrics/goals.ts` (9 testes), `lib/data/goals.ts`, `app/(app)/objetivos/actions.ts`, vitrine `/dev/objetivos`. Conferido em 375×812 e desktop com dados fictícios; consultas rodadas no banco real (só leitura). 174 testes, build ok. |
| 2026-11-13 | 2.5 ✓ | `lib/metrics/score.ts` (10 testes), `lib/data/today.ts`, Comando refeito em `ComandoView`: score do dia em anel no topo, faixa Hoje (Abordagens "—" até o Pipeline, Foco x/meta em Plasma, Hábitos feitos/previstos), "Movem faturamento" com 3 tarefas e checkbox direto, princípio do dia com cadastro inline. Vitrine `/dev/comando?tela=1` (e `&vazio=1`). Conferido em 375×812 e desktop; consultas no banco real (só leitura). 184 testes, build ok. |
