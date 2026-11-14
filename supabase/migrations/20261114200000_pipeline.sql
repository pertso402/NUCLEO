-- NÚCLEO · Fase 3.1 — pipeline (CRM): leads, eventos, abordagens e MRR.
-- O nome `public.leads` (e tipos parecidos) já é usado por outro sistema neste projeto Supabase,
-- então tudo do CRM do NÚCLEO tem prefixo `crm_` (tabelas e tipos). `outreach_logs` e `v_mrr` estão livres.
-- Dinheiro em centavos (bigint).

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
create type public.crm_lead_origin as enum ('indicacao', 'abordagem_fria', 'instagram', 'evento', 'cliente_atual', 'outro');
create type public.crm_lead_stage as enum ('abordado', 'conversou', 'reuniao', 'proposta', 'fechado', 'perdido');
create type public.crm_lost_reason as enum ('preco', 'timing', 'sem_resposta', 'concorrente', 'nao_viu_valor', 'outro');
create type public.crm_contract_status as enum ('ativo', 'encerrado');
create type public.crm_lead_event_type as enum ('stage_change', 'note', 'contact', 'followup_done');
create type public.outreach_channel as enum ('whatsapp', 'presencial', 'instagram', 'ligacao');

-- ------------------------------------------------------------
-- crm_leads — nenhum lead vivo sem próximo passo
-- ------------------------------------------------------------
create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  business text,
  phone text,
  segment text,
  origin public.crm_lead_origin not null default 'abordagem_fria',
  stage public.crm_lead_stage not null default 'abordado',
  monthly_value_cents bigint check (monthly_value_cents is null or monthly_value_cents > 0),
  setup_value_cents bigint check (setup_value_cents is null or setup_value_cents > 0),
  next_action text,
  next_action_on date,
  lost_reason public.crm_lost_reason,
  contract_status public.crm_contract_status,
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lead vivo precisa de próxima ação com data (ARCHITECTURE §4.5).
  constraint crm_leads_next_action_required check (
    stage in ('fechado', 'perdido')
    or (next_action is not null and length(trim(next_action)) > 0 and next_action_on is not null)
  ),
  constraint crm_leads_lost_reason_required check ((stage = 'perdido') = (lost_reason is not null)),
  constraint crm_leads_contract_only_closed check (contract_status is null or stage = 'fechado')
);
create index crm_leads_user_stage_idx on public.crm_leads (user_id, stage);
create index crm_leads_user_next_action_idx on public.crm_leads (user_id, next_action_on)
  where stage not in ('fechado', 'perdido');

-- ------------------------------------------------------------
-- crm_lead_events — histórico; fonte das taxas de conversão
-- ------------------------------------------------------------
create table public.crm_lead_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  type public.crm_lead_event_type not null,
  from_stage public.crm_lead_stage,
  to_stage public.crm_lead_stage,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_lead_events_user_created_idx on public.crm_lead_events (user_id, created_at desc);
create index crm_lead_events_lead_idx on public.crm_lead_events (lead_id, created_at);

-- ------------------------------------------------------------
-- outreach_logs — "abordei mais 5" sem cadastrar cada um
-- ------------------------------------------------------------
create table public.outreach_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  count int not null check (count > 0 and count <= 500),
  channel public.outreach_channel,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outreach_logs_user_date_idx on public.outreach_logs (user_id, log_date);

-- ------------------------------------------------------------
-- Triggers do lead: carimbo de etapa, fechamento e evento de mudança de etapa
-- ------------------------------------------------------------
create or replace function public.nucleo_crm_lead_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'fechado' then
      new.closed_at := coalesce(new.closed_at, now());
      new.contract_status := coalesce(new.contract_status, 'ativo');
    else
      new.closed_at := null;
      new.contract_status := null;
    end if;
    if new.stage <> 'perdido' then
      new.lost_reason := null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.nucleo_crm_lead_after()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crm_lead_events (user_id, lead_id, type, from_stage, to_stage)
    values (new.user_id, new.id, 'stage_change', null, new.stage);
  elsif new.stage is distinct from old.stage then
    insert into public.crm_lead_events (user_id, lead_id, type, from_stage, to_stage, payload)
    values (
      new.user_id, new.id, 'stage_change', old.stage, new.stage,
      case when new.stage = 'perdido' then jsonb_build_object('lost_reason', new.lost_reason) else '{}'::jsonb end
    );
  end if;
  return null;
end;
$$;

-- Evento só no lead do próprio dono (RLS checa só user_id do evento).
create or replace function public.nucleo_check_lead_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.crm_leads l where l.id = new.lead_id and l.user_id = new.user_id) then
    raise exception 'lead não pertence ao usuário';
  end if;
  return new;
end;
$$;
create trigger crm_lead_events_owner before insert or update on public.crm_lead_events
  for each row execute function public.nucleo_check_lead_owner();

create trigger crm_leads_before before insert or update on public.crm_leads
  for each row execute function public.nucleo_crm_lead_before();
create trigger crm_leads_after after insert or update on public.crm_leads
  for each row execute function public.nucleo_crm_lead_after();

-- ------------------------------------------------------------
-- updated_at + RLS (mesmo padrão das migrations anteriores)
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['crm_leads', 'crm_lead_events', 'outreach_logs'] loop
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
-- lead_id que ficou sem FK nas fases 1–2 agora aponta para crm_leads
-- ------------------------------------------------------------
alter table public.transactions
  add constraint transactions_lead_fk foreign key (lead_id) references public.crm_leads (id) on delete set null;
alter table public.tasks
  add constraint tasks_lead_fk foreign key (lead_id) references public.crm_leads (id) on delete set null;
alter table public.time_entries
  add constraint time_entries_lead_fk foreign key (lead_id) references public.crm_leads (id) on delete set null;
alter table public.recurring_rules
  add constraint recurring_rules_lead_fk foreign key (lead_id) references public.crm_leads (id) on delete set null;
create index transactions_lead_idx on public.transactions (lead_id) where lead_id is not null;
create index tasks_lead_idx on public.tasks (lead_id) where lead_id is not null;

-- ------------------------------------------------------------
-- v_mrr — soma das mensalidades de leads fechados com contrato ativo
-- ------------------------------------------------------------
create view public.v_mrr
with (security_invoker = true) as
select
  l.user_id,
  coalesce(sum(l.monthly_value_cents), 0)::bigint as mrr_cents,
  count(*)::int as active_contracts
from public.crm_leads l
where l.stage = 'fechado' and l.contract_status = 'ativo'
group by l.user_id;

-- ------------------------------------------------------------
-- Realtime: o pipeline e o Comando atualizam ao lançar pelo WhatsApp/Siri
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.crm_leads, public.outreach_logs;
  end if;
end;
$$;
