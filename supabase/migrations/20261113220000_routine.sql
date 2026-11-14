-- NÚCLEO · Fase 2.1 — rotina: objetivos, tarefas, hábitos, tempo, revisões, recorrências, push.
-- Dinheiro em centavos (bigint). Datas de calendário em `date` já no fuso de São Paulo.
-- `lead_id` fica sem FK até a Fase 3: o nome `public.leads` já é usado por outro sistema neste projeto.

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
create type public.goal_area as enum ('dinheiro', 'negocio', 'saude', 'mente', 'relacoes', 'aprendizado');
create type public.goal_status as enum ('active', 'done', 'dropped');
create type public.task_status as enum ('todo', 'done', 'dropped');

-- ------------------------------------------------------------
-- goals (objetivos do trimestre)
-- ------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  area public.goal_area not null,
  why text,
  quarter text not null check (quarter ~ '^\d{4}-Q[1-4]$'),
  target_date date,
  status public.goal_status not null default 'active',
  metric_label text,
  metric_target numeric,
  metric_current numeric,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_quarter_idx on public.goals (user_id, quarter, status, position);

-- ------------------------------------------------------------
-- tasks
-- ------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  due_on date,
  priority smallint not null default 2 check (priority between 1 and 3),
  moves_revenue boolean not null default false,
  goal_id uuid references public.goals (id) on delete set null,
  lead_id uuid,
  status public.task_status not null default 'todo',
  completed_at timestamptz,
  source public.capture_channel not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_done_has_date check ((status = 'done') = (completed_at is not null))
);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_on);
create index tasks_user_completed_idx on public.tasks (user_id, completed_at) where status = 'done';
create index tasks_goal_idx on public.tasks (goal_id);

-- ------------------------------------------------------------
-- habits + habit_logs
-- ------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  icon text,
  color_token text,
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_user_active_idx on public.habits (user_id, active, position);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_logs_once_per_day unique (habit_id, log_date)
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

-- ------------------------------------------------------------
-- time_entries (no máximo 1 timer aberto por usuário)
-- ------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  label text,
  lead_id uuid,
  goal_id uuid references public.goals (id) on delete set null,
  is_focus boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_order check (ended_at is null or ended_at >= started_at)
);
create unique index time_entries_one_open_timer on public.time_entries (user_id) where ended_at is null;
create index time_entries_user_started_idx on public.time_entries (user_id, started_at desc);

-- ------------------------------------------------------------
-- daily_reviews + weekly_reviews
-- ------------------------------------------------------------
create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  review_date date not null,
  score smallint check (score between 0 and 100),
  win text,
  lesson text,
  energy smallint check (energy between 1 and 5),
  tomorrow_top3 text[] not null default '{}' check (cardinality(tomorrow_top3) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_reviews_one_per_day unique (user_id, review_date)
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  wins text,
  misses text,
  focus_next_week text,
  numbers jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reviews_one_per_week unique (user_id, week_start)
);

-- ------------------------------------------------------------
-- recurring_rules (geram lançamento `pending_review` no dia — 2.11)
-- ------------------------------------------------------------
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  amount_cents bigint not null check (amount_cents > 0),
  kind public.money_kind not null,
  category_id uuid references public.categories (id) on delete set null,
  -- 29–31 em mês mais curto = último dia do mês (regra no código).
  day_of_month smallint not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  lead_id uuid,
  -- Último dia em que gerou lançamento: impede duplicar se a rotina rodar duas vezes.
  last_generated_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_rules_user_active_idx on public.recurring_rules (user_id, active, day_of_month);

-- ------------------------------------------------------------
-- push_subscriptions (Web Push da PWA)
-- ------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (user_id, endpoint)
);

-- ------------------------------------------------------------
-- habit_logs e time_entries pertencem ao mesmo dono do hábito/objetivo
-- (RLS checa só user_id; isto impede apontar para o hábito de outro usuário)
-- ------------------------------------------------------------
create or replace function public.nucleo_check_habit_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.habits h where h.id = new.habit_id and h.user_id = new.user_id) then
    raise exception 'hábito não pertence ao usuário';
  end if;
  return new;
end;
$$;
create trigger habit_logs_owner before insert or update on public.habit_logs
  for each row execute function public.nucleo_check_habit_owner();

-- ------------------------------------------------------------
-- updated_at + RLS (mesmo padrão das migrations anteriores)
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'goals', 'tasks', 'habits', 'habit_logs', 'time_entries',
    'daily_reviews', 'weekly_reviews', 'recurring_rules', 'push_subscriptions'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.nucleo_set_updated_at()',
      t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- v_habit_streaks — sequência atual e recorde por hábito (security_invoker: respeita o RLS)
--   target_per_week = 7 → em dias seguidos. Viva se o último dia marcado é hoje ou ontem.
--   target_per_week < 7 → em semanas (seg–dom) que bateram a meta. Viva se bateu nesta semana
--   ou na anterior (a semana em andamento não quebra a sequência).
--   "Hoje" é sempre em America/Sao_Paulo.
-- ------------------------------------------------------------
create view public.v_habit_streaks
with (security_invoker = true) as
with today as (
  select (now() at time zone 'America/Sao_Paulo')::date as d
),
day_runs as (
  select habit_id, max(log_date) as end_date, count(*)::int as len
  from (
    select l.habit_id, l.log_date,
           l.log_date - (row_number() over (partition by l.habit_id order by l.log_date))::int as grp
    from public.habit_logs l
  ) x
  group by habit_id, grp
),
week_hits as (
  select l.habit_id, date_trunc('week', l.log_date)::date as wk
  from public.habit_logs l
  join public.habits h on h.id = l.habit_id
  group by l.habit_id, date_trunc('week', l.log_date), h.target_per_week
  having count(*) >= h.target_per_week
),
week_runs as (
  select habit_id, max(wk) as end_wk, count(*)::int as len
  from (
    select habit_id, wk, wk - (7 * row_number() over (partition by habit_id order by wk))::int as grp
    from week_hits
  ) x
  group by habit_id, grp
)
select
  h.id as habit_id,
  h.user_id,
  case when h.target_per_week >= 7 then 'day' else 'week' end as unit,
  case when h.target_per_week >= 7 then
    coalesce((select r.len from day_runs r, today t where r.habit_id = h.id and r.end_date >= t.d - 1), 0)
  else
    coalesce((select r.len from week_runs r, today t
              where r.habit_id = h.id and r.end_wk >= date_trunc('week', t.d)::date - 7), 0)
  end as current_streak,
  case when h.target_per_week >= 7 then
    coalesce((select max(r.len) from day_runs r where r.habit_id = h.id), 0)
  else
    coalesce((select max(r.len) from week_runs r where r.habit_id = h.id), 0)
  end as best_streak,
  (select max(l.log_date) from public.habit_logs l where l.habit_id = h.id) as last_log_date
from public.habits h;

-- ------------------------------------------------------------
-- Realtime: o Comando e a Rotina atualizam sozinhos ao lançar pelo WhatsApp/Siri
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.habit_logs, public.time_entries;
  end if;
end;
$$;
