# CLAUDE.md — Regras de trabalho do projeto NÚCLEO

> NÚCLEO é o app pessoal do Peter (codinome — pode ser renomeado). É o "Jarvis" dele:
> finanças, marcos de receita, objetivos, tarefas, hábitos, horas, pipeline de leads e revisão.
> Usuário único. Tudo em PT-BR.

## Antes de qualquer coisa, em TODA sessão
1. Leia `PROGRESS.md` inteiro. Ele diz em que fase estamos e qual a próxima tarefa.
2. Leia a seção relevante de `ARCHITECTURE.md` (modelo de dados, endpoints, regras de negócio).
3. Para qualquer coisa visual, siga `DESIGN.md` à risca. Nada de cor, fonte ou espaçamento fora dos tokens.

## Como trabalhar
- **Uma tarefa por vez**, na ordem do `PROGRESS.md`. Não pule fase. Não adiante feature de fase futura.
- Ao terminar cada tarefa:
  1. Rode `npm run typecheck && npm run lint && npm run test`.
  2. Marque `[x]` no `PROGRESS.md` e escreva 1 linha no **Log de sessões** (data, o que foi feito, decisões).
  3. Commit: `feat(fase-N): descrição curta`.
- Se precisar tomar uma decisão que não está nos documentos, **registre em "Decisões tomadas" no `PROGRESS.md`** com o motivo.
- Se algo bloquear (credencial faltando, serviço fora), registre em **Bloqueios** e siga para a próxima tarefa que não depende dele.
- Ao final de cada fase, cheque os **critérios de aceite** da fase antes de marcá-la como concluída.

## Regras invioláveis
- **Dinheiro sempre em centavos (`bigint`)**. Nunca `float`. Formatação só na UI (`Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`).
- **Fuso horário: `America/Sao_Paulo`** em todo cálculo de "hoje", "mês", "dia útil". Datas no banco em `timestamptz`; datas de calendário (hábitos, revisão) em `date` já no fuso local.
- **RLS ligado em todas as tabelas.** Chave `service_role` só no servidor (API routes), nunca no client.
- **Toda captura (WhatsApp, Siri, app) passa por `/api/ingest`** e gera registro em `inbox_messages`. Sem exceção — é o que permite "desfaz" e depuração.
- Endpoints públicos (`/api/ingest`, `/api/widget`, `/api/cron/*`) exigem header `x-nucleo-token` igual a `NUCLEO_API_TOKEN`. Comparação em tempo constante.
- UI 100% em português do Brasil. Código, nomes de tabela e variáveis em inglês.
- Mobile-first: tudo tem que funcionar bem em 375px (iPhone 11 Pro) antes de ajustar desktop.
- Performance no iPhone 11 Pro: evite `backdrop-filter` em listas longas, anime só `transform` e `opacity`.

## Stack (não trocar sem registrar decisão)
Next.js (App Router) + TypeScript strict · Tailwind CSS · Supabase (Postgres, Auth, Realtime) · Vercel ·
Motion (framer-motion) · Recharts · Zod · TanStack Query · Serwist (PWA/service worker) · Vitest + Playwright ·
Claude API (parsing e briefings) · ElevenLabs Speech-to-Text (áudio) · Evolution API (WhatsApp) · n8n (ponte e agendamentos).

Se os conectores de Supabase e Vercel estiverem disponíveis na sessão, use-os para migrations, deploy e logs.

## Comandos
- `npm run dev` — local
- `npm run typecheck` / `npm run lint` / `npm run test` / `npm run e2e`
- `npx supabase migration new <nome>` — toda mudança de schema é migration versionada em `supabase/migrations/`
