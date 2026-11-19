-- NÚCLEO · Produtividade (pedido do Peter, 19/11): projetos/negócios, tarefas e tempo por projeto,
-- pomodoro. Tudo com RLS, `updated_at` e dono checado nas referências cruzadas.

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
create type public.nucleo_project_kind as enum ('negocio', 'cliente', 'projeto', 'pessoal', 'estudo');
create type public.nucleo_project_status as enum ('active', 'paused', 'done', 'archived');
create type public.nucleo_time_entry_kind as enum ('timer', 'pomodoro', 'manual');
-- tarefa em andamento (coluna "Fazendo")
alter type public.task_status add value if not exists 'doing' after 'todo';

-- ------------------------------------------------------------
-- projects — cada tarefa e cada minuto podem pertencer a um projeto/negócio
-- ------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind public.nucleo_project_kind not null default 'projeto',
  status public.nucleo_project_status not null default 'active',
  -- cor de projeto (paleta categórica do DESIGN §2b), só para distinguir nos gráficos
  color text not null default 'violet'
    check (color in ('violet', 'cyan', 'lime', 'amber', 'pink', 'teal', 'blue', 'orange')),
  description text,
  lead_id uuid references public.crm_leads (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  weekly_hours_goal numeric check (weekly_hours_goal is null or (weekly_hours_goal > 0 and weekly_hours_goal <= 168)),
  deadline date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_status_idx on public.projects (user_id, status, position);

-- ------------------------------------------------------------
-- tarefas e tempo ganham projeto / tarefa / tipo
-- ------------------------------------------------------------
alter table public.tasks
  add column project_id uuid references public.projects (id) on delete set null,
  add column estimate_minutes int check (estimate_minutes is null or (estimate_minutes > 0 and estimate_minutes <= 6000));
create index tasks_project_idx on public.tasks (project_id) where project_id is not null;

alter table public.time_entries
  add column project_id uuid references public.projects (id) on delete set null,
  add column task_id uuid references public.tasks (id) on delete set null,
  add column kind public.nucleo_time_entry_kind not null default 'timer',
  -- pomodoro: duração planejada da sessão (25 min…)
  add column planned_minutes int check (planned_minutes is null or (planned_minutes > 0 and planned_minutes <= 240));
create index time_entries_project_idx on public.time_entries (user_id, project_id, started_at);
create index time_entries_task_idx on public.time_entries (task_id) where task_id is not null;

-- ------------------------------------------------------------
-- configurações do pomodoro
-- ------------------------------------------------------------
alter table public.settings
  add column pomodoro_focus_minutes int not null default 25 check (pomodoro_focus_minutes between 5 and 120),
  add column pomodoro_short_break_minutes int not null default 5 check (pomodoro_short_break_minutes between 1 and 60),
  add column pomodoro_long_break_minutes int not null default 15 check (pomodoro_long_break_minutes between 1 and 90),
  add column pomodoro_cycles int not null default 4 check (pomodoro_cycles between 2 and 10);

-- ------------------------------------------------------------
-- Dono: tarefa/tempo só apontam para projeto/tarefa do mesmo usuário (RLS checa só user_id)
-- ------------------------------------------------------------
create or replace function public.nucleo_check_project_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is not null
     and not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'projeto não pertence ao usuário';
  end if;
  return new;
end;
$$;

create or replace function public.nucleo_check_time_task_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.task_id is not null
     and not exists (select 1 from public.tasks t where t.id = new.task_id and t.user_id = new.user_id) then
    raise exception 'tarefa não pertence ao usuário';
  end if;
  return new;
end;
$$;

create trigger tasks_project_owner before insert or update of project_id on public.tasks
  for each row execute function public.nucleo_check_project_owner();
create trigger time_entries_project_owner before insert or update of project_id on public.time_entries
  for each row execute function public.nucleo_check_project_owner();
create trigger time_entries_task_owner before insert or update of task_id on public.time_entries
  for each row execute function public.nucleo_check_time_task_owner();

-- ------------------------------------------------------------
-- updated_at + RLS
-- ------------------------------------------------------------
create trigger projects_updated_at before update on public.projects
  for each row execute function public.nucleo_set_updated_at();
alter table public.projects enable row level security;
create policy projects_select_own on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy projects_insert_own on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy projects_update_own on public.projects for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy projects_delete_own on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.projects;
  end if;
end;
$$;
