-- NÚCLEO · Fase 1.1 — lançamentos, marcos e views de totais.
-- Dinheiro sempre em centavos (bigint). Datas de fato em `date` no fuso de São Paulo.

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
create type public.transaction_source as enum ('whatsapp', 'siri', 'app', 'openfinance', 'import');
create type public.transaction_status as enum ('confirmed', 'pending_review');
create type public.milestone_metric as enum ('revenue_month', 'revenue_cumulative', 'mrr', 'net_month');
create type public.milestone_status as enum ('active', 'achieved', 'archived');

-- ------------------------------------------------------------
-- transactions
-- ------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  kind public.money_kind not null,
  category_id uuid references public.categories (id) on delete set null,
  description text,
  counterparty text,
  -- FK para o pipeline entra na Fase 3 (o nome `public.leads` já é usado por outro sistema neste projeto).
  lead_id uuid,
  source public.transaction_source not null default 'app',
  inbox_message_id uuid references public.inbox_messages (id) on delete set null,
  external_id text,
  status public.transaction_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_external_id_unique unique (user_id, external_id)
);
create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_user_kind_date_idx on public.transactions (user_id, kind, occurred_on);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_inbox_idx on public.transactions (inbox_message_id);

-- ------------------------------------------------------------
-- milestones
-- ------------------------------------------------------------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  metric public.milestone_metric not null,
  target_cents bigint not null check (target_cents > 0),
  period_start date,
  period_end date,
  deadline date,
  status public.milestone_status not null default 'active',
  achieved_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_period_order check (period_start is null or period_end is null or period_start <= period_end),
  constraint milestones_achieved_has_date check ((status = 'achieved') = (achieved_at is not null))
);
create index milestones_user_status_position_idx on public.milestones (user_id, status, position);

-- ------------------------------------------------------------
-- updated_at + RLS (mesmo padrão da migration inicial)
-- ------------------------------------------------------------
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.nucleo_set_updated_at();
create trigger milestones_updated_at before update on public.milestones
  for each row execute function public.nucleo_set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['transactions', 'milestones'] loop
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
-- Views (security_invoker: respeitam o RLS de quem consulta)
-- Só lançamentos confirmados entram nos totais.
-- ------------------------------------------------------------
create view public.v_month_totals
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_on)::date as month,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0)::bigint  as income_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)::bigint as expense_cents,
  (coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0)
   - coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0))::bigint as net_cents,
  count(*)::int as transaction_count
from public.transactions t
where t.status = 'confirmed'
group by t.user_id, date_trunc('month', t.occurred_on);

create view public.v_category_breakdown
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_on)::date as month,
  t.kind,
  t.category_id,
  coalesce(c.name, 'Sem categoria') as category_name,
  c.icon,
  c.color_token,
  sum(t.amount_cents)::bigint as total_cents,
  count(*)::int as transaction_count
from public.transactions t
left join public.categories c on c.id = t.category_id
where t.status = 'confirmed'
group by t.user_id, date_trunc('month', t.occurred_on), t.kind, t.category_id, c.name, c.icon, c.color_token;

-- ------------------------------------------------------------
-- Realtime: o anel do Comando atualiza sozinho ao lançar (Fase 1.5)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.transactions, public.milestones;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Marco inicial do Peter: "R$ 10k de receita" em nov/2026.
-- Só para quem já tem `settings` do NÚCLEO (o projeto é compartilhado com outros sistemas).
-- ------------------------------------------------------------
insert into public.milestones (user_id, title, metric, target_cents, period_start, period_end, deadline, position)
select s.user_id, 'R$ 10k de receita', 'revenue_month', 1000000, '2026-11-01', '2026-11-30', '2026-11-30', 0
from public.settings s
where not exists (
  select 1 from public.milestones m where m.user_id = s.user_id and m.title = 'R$ 10k de receita'
);
