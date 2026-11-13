# ARCHITECTURE.md — NÚCLEO

## 1. Visão do produto

O NÚCLEO é o centro de comando pessoal do Peter. Princípio central:

> **Lançar tem que ser mais fácil que esquecer.** Captura por voz/texto (WhatsApp, Siri, botão no app).
> O app é para **ver**: progresso, ritmo, o que falta e o que fazer hoje.

Objetivos de design do produto:
1. **Motivação por números** — ver a receita crescendo, quanto falta pro marco, o ritmo necessário por dia e a projeção.
2. **Meta grande → ação do dia** — o funil reverso transforma "faltam R$ X" em "hoje: N abordagens".
3. **Plano estratégico pessoal** — objetivos trimestrais, revisão semanal e diária. O Peter faz isso para empresas; aqui ele faz para ele mesmo.
4. **Fricção zero** — um áudio no WhatsApp resolve 90% dos lançamentos.

Usuário único e **um dinheiro só**: o Peter trabalha como autônomo (serviços como PJ, sem CNPJ nem empresa) e não separa pessoal de trabalho. Não existe etiqueta `arte`/`pessoal`; quanto custa trabalhar (ferramentas, anúncios) sai das categorias.

---

## 2. Visão geral do sistema

```
 iPhone 11 Pro                         PC (Windows)
 ┌────────────────────────┐            ┌────────────────────────┐
 │ PWA instalada (tela de │            │ PWA instalada via       │
 │ início) + Push         │            │ Chrome/Edge (janela     │
 │ Widget Scriptable      │            │ própria) + Cmd/Ctrl+K   │
 │ Atalho Siri            │            └───────────┬────────────┘
 │ WhatsApp               │                        │
 └──┬───────┬──────────┬──┘                        │
    │       │          │                           │
    │ Siri  │ Widget   │ WhatsApp                  │
    │ POST  │ GET      │                           │
    ▼       ▼          ▼                           ▼
 ┌──────────────────────────────┐    ┌──────────────────────────────┐
 │ Next.js na Vercel             │◄───│ n8n (EasyPanel)               │
 │  /api/ingest  (texto→ação)    │    │  • Evolution webhook → áudio? │
 │  /api/ingest/audio            │    │    → ElevenLabs STT → /ingest │
 │  /api/widget                  │    │  • Responde no WhatsApp       │
 │  /api/cron/* (briefings)      │    │  • Schedules → /api/cron/*    │
 │  App (RSC + client)           │    └──────────────┬───────────────┘
 └──────────────┬───────────────┘                   │
                │                                   ▼
                ▼                         ┌──────────────────┐
 ┌──────────────────────────────┐        │ Evolution API     │
 │ Supabase                      │        │ (WhatsApp)        │
 │  Postgres + RLS + Views       │        └──────────────────┘
 │  Auth (e-mail OTP)            │
 │  Realtime (atualiza a tela)   │        ┌──────────────────┐
 └──────────────────────────────┘        │ OpenAI API        │◄── parsing + briefings
                                          │ ElevenLabs STT    │◄── áudio
                                          │ Pluggy (fase 4)   │◄── Open Finance
                                          └──────────────────┘
```

**Regra:** toda lógica de negócio vive no código (Next.js + SQL). O n8n é só ponte (WhatsApp/áudio) e relógio (agendamentos).

---

## 3. Stack e estrutura de pastas

```
nucleo/
├─ app/
│  ├─ (auth)/login/
│  ├─ (app)/
│  │  ├─ page.tsx                 # Comando (home HUD)
│  │  ├─ dinheiro/                # extrato, relatórios
│  │  ├─ marcos/
│  │  ├─ objetivos/
│  │  ├─ rotina/                  # tarefas + hábitos + tempo (abas)
│  │  ├─ pipeline/                # CRM kanban + funil reverso
│  │  ├─ revisao/                 # diária e semanal
│  │  └─ ajustes/
│  ├─ api/
│  │  ├─ ingest/route.ts
│  │  ├─ ingest/audio/route.ts
│  │  ├─ widget/route.ts
│  │  ├─ cron/briefing-manha/route.ts
│  │  ├─ cron/fechamento-dia/route.ts
│  │  ├─ cron/revisao-semanal/route.ts
│  │  ├─ cron/followups/route.ts
│  │  └─ push/subscribe/route.ts
│  ├─ manifest.ts
│  └─ sw.ts                       # Serwist
├─ components/
│  ├─ hud/                        # RingProgress, StatTicker, HudCard, Sparkline, GridBackground
│  ├─ capture/                    # CaptureButton, CommandPalette, AudioRecorder
│  └─ ui/                         # primitivos (Button, Input, Sheet, Tabs...)
├─ lib/
│  ├─ supabase/ (server.ts, client.ts, admin.ts)
│  ├─ ingest/ (parser.ts, tools.ts, executor.ts, undo.ts)
│  ├─ metrics/ (pace.ts, funnel.ts, score.ts, business-days.ts)
│  ├─ money.ts
│  ├─ dates.ts                    # tudo em America/Sao_Paulo
│  └─ evolution.ts                # envio de mensagem WhatsApp
├─ supabase/migrations/
├─ integrations/
│  ├─ n8n/                        # JSON dos workflows exportados
│  ├─ scriptable/nucleo-widget.js
│  └─ siri/README.md              # passo a passo do Atalho
├─ tests/ (unit + e2e)
├─ CLAUDE.md · ARCHITECTURE.md · DESIGN.md · PROGRESS.md
```

---

## 4. Modelo de dados (Postgres)

Todas as tabelas: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users`, `created_at timestamptz default now()`, `updated_at timestamptz` (trigger). RLS: `user_id = auth.uid()` para select/insert/update/delete.

### 4.1 Configuração
**settings** (1 linha)
| coluna | tipo | nota |
|---|---|---|
| timezone | text | default `America/Sao_Paulo` |
| workdays | int[] | default `{1,2,3,4,5}` (seg–sex) |
| daily_outreach_goal | int | meta de abordagens/dia (manual, sobrescrita pelo funil reverso se `auto_outreach_goal`) |
| auto_outreach_goal | bool | default true |
| daily_focus_minutes_goal | int | default 240 |
| default_conv_rates | jsonb | taxas padrão do funil enquanto não há amostra (ver 6.3) |
| default_ticket_cents | bigint | ticket médio padrão de contrato |
| whatsapp_number | text | único número autorizado a lançar |
| briefing_morning_time / briefing_night_time | time | default 07:30 / 21:30 |

**principles** — `text`, `position int`, `active bool`. Princípios pessoais; um por dia em rotação no Comando.

### 4.2 Finanças
**categories** — `name`, `kind` (`income`|`expense`), `icon`, `color_token`, `archived bool`.
Seed: Receita de cliente, Setup/implantação, Outras receitas · Alimentação, Transporte/Combustível, Moradia, Assinaturas/Ferramentas, Anúncios, Lazer, Saúde, Roupas, Educação, Outros.

**transactions**
| coluna | tipo | nota |
|---|---|---|
| occurred_on | date | dia do fato (fuso local) |
| amount_cents | bigint | sempre positivo |
| kind | enum `income`/`expense` | |
| category_id | uuid fk | |
| description | text | |
| counterparty | text | cliente/loja |
| lead_id | uuid fk null | receita vinculada a cliente do pipeline |
| source | enum `whatsapp`/`siri`/`app`/`openfinance`/`import` | |
| inbox_message_id | uuid fk null | origem da captura |
| external_id | text unique null | id do Pluggy (dedupe) |
| status | enum `confirmed`/`pending_review` | open finance entra como `pending_review` |

**recurring_rules** (fase 2) — `description`, `amount_cents`, `kind`, `category_id`, `day_of_month`, `active`, `lead_id null`. Gera lançamento `pending_review` no dia (mensalidade de cliente, aluguel, assinaturas).

### 4.3 Marcos e objetivos
**milestones**
| coluna | tipo | nota |
|---|---|---|
| title | text | ex.: "Primeiros R$ 10k/mês" |
| metric | enum | `revenue_month` (receita do mês), `revenue_cumulative` (receita acumulada), `mrr` (mensalidades fechadas ativas), `net_month` (receita − despesa do mês) |
| target_cents | bigint | |
| period_start / period_end | date null | para métricas mensais, null = mês corrente recorrente |
| deadline | date null | |
| status | enum `active`/`achieved`/`archived` | |
| achieved_at | timestamptz null | preenchido por trigger/rotina quando bate |
| position | int | o marco `position=0` ativo é o destaque do Comando |

**goals** (objetivos — plano estratégico pessoal)
`title`, `area` (`dinheiro`,`negocio`,`saude`,`mente`,`relacoes`,`aprendizado`), `why text`, `quarter text` (ex. `2026-Q4`), `target_date`, `status` (`active`/`done`/`dropped`), `metric_label text null`, `metric_target numeric null`, `metric_current numeric null`.

### 4.4 Execução
**tasks** — `title`, `notes`, `due_on date null`, `priority` (1–3), `moves_revenue bool` (tarefa que mexe faturamento), `goal_id null`, `lead_id null`, `status` (`todo`/`done`/`dropped`), `completed_at`, `source`.

**habits** — `name`, `icon`, `color_token`, `target_per_week int`, `active`, `position`.
**habit_logs** — `habit_id`, `log_date date`, unique(`habit_id`,`log_date`).

**time_entries** — `started_at`, `ended_at null` (null = timer rodando; no máximo 1 aberto — índice parcial único), `label text`, `lead_id null`, `goal_id null`, `is_focus bool default true`.

### 4.5 Pipeline (CRM)
**leads**
| coluna | tipo | nota |
|---|---|---|
| name | text | pessoa |
| business | text | empresa |
| phone | text null | |
| segment | text null | pizzaria, sorveteria, mercado... |
| origin | enum | `indicacao`,`abordagem_fria`,`instagram`,`evento`,`cliente_atual`,`outro` |
| stage | enum | `abordado`,`conversou`,`reuniao`,`proposta`,`fechado`,`perdido` |
| monthly_value_cents | bigint null | mensalidade proposta/fechada |
| setup_value_cents | bigint null | implantação |
| next_action | text null | |
| next_action_on | date null | |
| lost_reason | enum null | `preco`,`timing`,`sem_resposta`,`concorrente`,`nao_viu_valor`,`outro` |
| contract_status | enum null | `ativo`,`encerrado` (após fechado) |
| stage_changed_at, closed_at | timestamptz | |
| notes | text | |

**Constraint:** `next_action` e `next_action_on` obrigatórios quando `stage not in ('fechado','perdido')`. `lost_reason` obrigatório quando `stage='perdido'`. *(Nenhum lead vivo sem próximo passo.)*

**lead_events** — `lead_id`, `type` (`stage_change`,`note`,`contact`,`followup_done`), `from_stage`, `to_stage`, `payload jsonb`. Trigger em `leads` grava `stage_change` automaticamente. É a fonte das taxas de conversão.

**outreach_logs** — `log_date`, `count int`, `channel` (`whatsapp`,`presencial`,`instagram`,`ligacao`). Para "abordei mais 5" sem cadastrar cada um. Abordagens do dia = `count(leads criados hoje em 'abordado')` + `sum(outreach_logs.count)` do dia.

### 4.6 Revisão
**daily_reviews** — `review_date` unique, `score int` (calculado, 0–100), `win text` (vitória do dia), `lesson text`, `energy int 1–5`, `tomorrow_top3 text[]`.
**weekly_reviews** — `week_start date` unique, `wins`, `misses`, `focus_next_week`, `numbers jsonb` (snapshot das métricas da semana).

### 4.7 Infra
**inbox_messages** — `channel` (`whatsapp`,`siri`,`app`,`palette`), `raw_text`, `audio_url null`, `parsed jsonb` (chamadas de ferramenta), `result jsonb` (ids criados/alterados com estado anterior para undo), `status` (`ok`,`needs_clarification`,`error`,`undone`), `reply_text`, `error text`.
**push_subscriptions** — `endpoint`, `keys jsonb`, `device_label`.
**sync_state** (fase 4) — `provider`, `item_id`, `last_synced_at`, `consent_expires_at`.

### 4.8 Views / funções SQL
- `v_month_totals(month)` — receita, despesa e saldo do mês.
- `v_category_breakdown(month)`.
- `v_mrr` — soma de `monthly_value_cents` de leads `fechado` + `contract_status='ativo'`.
- `v_habit_streaks` — streak atual e recorde por hábito.
- `fn_business_days(from, to, workdays)` — dias úteis (fase 5: feriados nacionais numa tabela `holidays`).
- `fn_milestone_progress(milestone_id)` — ver 6.1.
- `fn_funnel_rates(window_days default 90)` — ver 6.3.

---

## 5. Captura: o pipeline `/api/ingest`

### 5.1 Entradas
| Canal | Caminho |
|---|---|
| WhatsApp texto | Evolution → webhook n8n → valida número = `settings.whatsapp_number` → POST `/api/ingest` → n8n responde com `reply_text` via Evolution |
| WhatsApp áudio | igual, mas n8n baixa o áudio → ElevenLabs STT (pt) → texto → `/api/ingest` |
| Siri | Atalho iOS: "Ditar texto" → POST `/api/ingest` `{channel:'siri', text}` → mostra `reply_text` |
| App (botão de captura) | grava áudio (MediaRecorder) → `/api/ingest/audio` (STT server-side) ou texto → `/api/ingest` |
| Desktop | Command palette (Ctrl/Cmd+K) → `/api/ingest` |

Payload: `{ channel, text, client_ts }`. Resposta: `{ status, reply_text, actions: [...] , inbox_id }`.

### 5.2 Parser (OpenAI API com function calling)
- Modelo de parsing: modelo pequeno e barato da OpenAI, configurável em `OPENAI_MODEL`. Uma nova tentativa com `OPENAI_MODEL_FALLBACK` se a chamada de ferramenta vier inválida.
- System prompt inclui: data/hora atual em São Paulo, lista de categorias, hábitos ativos, leads vivos (nome + empresa + stage, máx. 50), timer aberto.
- Uma mensagem pode gerar várias ações ("gastei 40 de gasolina e fiz academia" = 2 ferramentas).
- Se faltar dado essencial (valor, ou lead ambíguo), usar `ask_clarification` → status `needs_clarification`, e a próxima mensagem do mesmo canal em até 10 min é tratada como resposta.

**Ferramentas:**
| ferramenta | efeito |
|---|---|
| `add_transaction` | {kind, amount_cents, category, description, counterparty?, occurred_on?, lead_ref?} |
| `add_task` | {title, due_on?, moves_revenue?, goal_ref?, lead_ref?} |
| `complete_task` | {task_ref} |
| `log_habit` | {habit_ref, date?} |
| `start_timer` / `stop_timer` | {label?} |
| `log_time` | {minutes, label, date?} |
| `create_lead` | {name, business?, origin?, stage default 'abordado', next_action, next_action_on} |
| `update_lead` | {lead_ref, stage?, next_action?, next_action_on?, lost_reason?, monthly_value_cents?, note?} |
| `log_outreach` | {count, channel?} |
| `query` | perguntas: "quanto gastei com comida esse mês?", "quanto falta pro marco?" → resposta calculada no servidor (o modelo só escolhe a consulta; os números vêm do SQL) |
| `undo_last` | reverte a última `inbox_message` com status `ok` usando `result` |
| `ask_clarification` | {question} |

**Resposta padrão (curta, WhatsApp):**
```
✅ Receita R$ 1.500 · Cliente X
📈 Marco "R$ 10k/mês": R$ 6.200 → faltam R$ 3.800 (62%)
↩️ "desfaz" pra reverter
```
Toda receita responde com o novo estado do marco. Esse é o reforço positivo.

### 5.3 Segurança
- `x-nucleo-token` em todos os endpoints de captura/cron/widget.
- n8n descarta mensagens de qualquer número que não seja o do Peter.
- Rate limit simples (30 req/min) em `/api/ingest`.
- `inbox_messages` guarda tudo por 180 dias.

---

## 6. Regras de negócio (o motor de motivação)

Implementar em `lib/metrics/` com testes unitários (Vitest) cobrindo virada de mês, fim de semana, marco já batido e meta zero.

### 6.1 Progresso do marco (`pace.ts`)
Para o marco em destaque, no período atual:
```
current        = valor da métrica no período até hoje
remaining      = max(target - current, 0)
pct            = current / target
bd_total       = dias úteis do período
bd_elapsed     = dias úteis decorridos (incluindo hoje se já passou das 12h)
bd_left        = bd_total - bd_elapsed  (mínimo 1)
pace_needed    = remaining / bd_left                → "precisa de R$ X por dia útil"
pace_current   = current / max(bd_elapsed, 1)       → "teu ritmo: R$ Y por dia útil"
on_track       = pace_current >= pace_needed
projection     = pace_current * bd_total            → "nesse ritmo você fecha o mês em R$ Z"
eta_date       = data em que current + pace_current*n >= target (null se pace_current = 0)
```
Textos gerados:
- `on_track`: "No ritmo. Projeção: R$ Z (+R$ Z−target acima do marco)."
- `!on_track`: "Abaixo do ritmo. Faltam R$ X em N dias úteis — R$ P/dia."
- Ao bater: status `achieved`, `achieved_at`, celebração na UI (ver DESIGN.md) e mensagem especial no WhatsApp. O próximo marco ativo assume o destaque.

### 6.2 Score do dia (`score.ts`) — 0 a 100
| componente | peso | cálculo |
|---|---|---|
| Tarefas que mexem faturamento | 35 | concluídas hoje / (planejadas para hoje, máx. 3) |
| Abordagens | 25 | min(abordagens hoje / meta do dia, 1) |
| Foco | 20 | min(minutos de foco hoje / meta, 1) |
| Hábitos | 20 | hábitos marcados hoje / hábitos previstos para hoje |
Fim de semana: abordagens e foco saem da conta e os pesos são redistribuídos proporcionalmente. Score salvo em `daily_reviews` no fechamento do dia.

### 6.3 Funil reverso (`funnel.ts`)
Taxas de conversão por etapa a partir de `lead_events` dos últimos 90 dias:
```
r1 = abordado → conversou
r2 = conversou → reuniao
r3 = reuniao → proposta
r4 = proposta → fechado
```
Se uma etapa tiver amostra < 10, usa `settings.default_conv_rates` (padrão inicial: r1 0,30 · r2 0,40 · r3 0,70 · r4 0,35 — o Peter ajusta) e a UI mostra o selo "estimado".
Ticket = média de `monthly_value_cents` dos fechados nos últimos 180 dias, ou `default_ticket_cents`.
```
contratos   = ceil(remaining_do_marco_mrr / ticket)
propostas   = ceil(contratos / r4)
reunioes    = ceil(propostas / r3)
conversas   = ceil(reunioes / r2)
abordagens  = ceil(conversas / r1)
por_dia     = ceil(abordagens / bd_left)
```
Se `auto_outreach_goal`, `por_dia` vira a meta de abordagens do dia (mínimo 1).
Considera também o que já está no pipeline: propostas abertas contam como contratos prováveis (`propostas_abertas * r4`) e são abatidas antes de calcular abordagens.

### 6.4 Follow-ups
- "Atrasado" = `next_action_on < hoje` e lead vivo. Aparece em laranja (ember) no Comando e no pipeline.
- Lead em `proposta` sem mudança há 7+ dias → sugestão automática de follow-up.

---

## 7. Telas

Navegação mobile: tab bar inferior — **Comando · Dinheiro · Pipeline · Rotina · Mais** + botão flutuante de captura (microfone).
Desktop: sidebar fixa à esquerda + Ctrl/Cmd+K (command palette que também lança via `/api/ingest`).

1. **Comando (home)** — a tela que mais importa.
   - Hero: anel de progresso do marco em destaque, valor atual com ticker animado, "faltam R$ X", ritmo necessário vs atual, projeção.
   - Faixa "Hoje": score do dia (ao vivo), abordagens N/meta, foco Xh/meta, hábitos ✓.
   - Top 3 tarefas que mexem faturamento (checkbox direto).
   - Follow-ups do dia / atrasados.
   - Princípio do dia (rotação de `principles`).
   - Timer (iniciar/parar, label).
2. **Dinheiro** — extrato com filtros (mês, categoria), edição inline, revisão de pendentes (`pending_review`); relatórios: receita × despesa do mês, categorias, evolução 12 meses (barras), receita acumulada (linha).
3. **Marcos** — marco atual em destaque, fila dos próximos, **linha do tempo de conquistas** (cada marco batido com data e quanto tempo levou).
4. **Objetivos** — por trimestre e área, com "por quê", métrica e tarefas vinculadas.
5. **Rotina** (abas) — Tarefas (Hoje · Semana · Backlog) · Hábitos (heatmap de 12 semanas, streak atual/recorde) · Tempo (horas por dia/semana, por label).
6. **Pipeline** — kanban por etapa (arrastar no desktop, ação rápida no mobile), card com próxima ação e data; painel do funil reverso; taxas por etapa; motivos de perda (barras); origem dos leads que fecham.
7. **Revisão** — fechamento do dia (vitória, aprendizado, energia, top 3 de amanhã — 60 segundos); revisão semanal com snapshot dos números da semana vs anterior.
8. **Ajustes** — categorias, hábitos, princípios, metas diárias, taxas padrão do funil, horários de briefing, notificações, token da API, integrações.

---

## 8. Automações (n8n chama `/api/cron/*`)

| quando | endpoint | o que faz |
|---|---|---|
| dias úteis 07:30 | `briefing-manha` | WhatsApp: marco + ritmo, top 3 do dia, meta de abordagens, follow-ups, princípio do dia |
| todo dia 21:30 | `fechamento-dia` | calcula score, manda placar do dia + link pra revisão rápida |
| domingo 18:00 | `revisao-semanal` | números da semana vs anterior, pede vitórias/erros/foco |
| dias úteis 13:30 | `followups` | se houver follow-up pendente do dia: lembrete com lista |
| dia 1 do mês 08:00 | `briefing-manha?monthly=1` | fechamento do mês anterior + marco do novo mês |

Textos dos briefings gerados pela OpenAI (`OPENAI_MODEL_BRIEFING`) a partir de um JSON de números calculado no servidor (o modelo só redige; nunca inventa número). Tom: direto, motivador sem ser meloso, em PT-BR informal.

Push (Web Push/VAPID) espelha os briefings quando a PWA estiver instalada; WhatsApp é o canal principal.

---

## 9. Integrações no iPhone

- **PWA**: `manifest` com `display: standalone`, ícones 180/192/512, `theme_color` = `--bg-0`, splash. Instruções na tela de login: Safari → Compartilhar → Adicionar à Tela de Início.
- **Atalho Siri** (`integrations/siri/README.md`): Ditar texto → Obter conteúdo do URL (POST `/api/ingest`, header `x-nucleo-token`, JSON `{channel:'siri', text}`) → Mostrar resultado `reply_text`. Frase: "Lançar no Núcleo".
- **Widget Scriptable** (`integrations/scriptable/nucleo-widget.js`): GET `/api/widget` → `{ milestone_title, current_cents, target_cents, pct, remaining_cents, pace_needed_cents, score_today, outreach_today, outreach_goal }`. Widget médio: barra do marco + "faltam R$ X" + abordagens N/meta. Cores dos tokens do DESIGN.md. Atualização a cada ~15 min (limite do iOS).

---

## 10. Open Finance (fase 4)

- Via **Meu Pluggy** (acesso gratuito aos dados do próprio CPF). Ler a documentação atual da Pluggy antes de implementar.
- Sync diário (n8n 06:00 → `/api/cron/openfinance-sync`): busca transações novas, grava com `source='openfinance'`, `status='pending_review'`, `external_id` para dedupe.
- **Conciliação**: se já existir lançamento manual com mesmo valor ± 1 dia, vincula em vez de duplicar.
- Categorização sugerida pelo parser; Peter confirma em lote na tela Dinheiro.
- Consentimento expira em 12 meses: guardar `consent_expires_at` e avisar 15 dias antes.

---

## 11. Variáveis de ambiente
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NUCLEO_API_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL=                 # parser (rápido e barato)
OPENAI_MODEL_FALLBACK=        # retry quando a chamada vier inválida
OPENAI_MODEL_BRIEFING=        # textos dos briefings
ELEVENLABS_API_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
PETER_WHATSAPP_NUMBER=        # único número autorizado (formato 55DDDNUMERO)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
PLUGGY_CLIENT_ID=             # fase 4
PLUGGY_CLIENT_SECRET=         # fase 4
```

## 12. Testes mínimos
- Unit: `money`, `dates` (virada de mês em SP), `business-days`, `pace`, `score`, `funnel`, executor de cada ferramenta, `undo`.
- Parser: 30 frases reais de exemplo em `tests/fixtures/ingest.json` com a saída esperada (ex.: "gastei 38 no almoço", "recebi 1500 da pizzaria", "abordei mais 4 hoje", "fulano da sorveteria pediu proposta, manda sexta", "fiz academia e li 20 min", "começa timer cardápio choppatinhas", "desfaz").
- E2E (Playwright, viewport 375×812): login, lançar pela palette, ver o anel atualizar, mover lead de etapa, marcar hábito.
