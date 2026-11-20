-- ============================================================
-- Fase P.8 — Departamentos, prioridade e sequência de tarefas
-- Cada projeto tem departamentos (Marketing, Comercial, Operação…), cada um com prioridade
-- e, se quiser, uma sequência de tarefas (a ordem lógica de execução).
-- Prioridade (projeto, departamento e tarefa): 0 urgente/agora · 1 alta · 2 média · 3 baixa.
-- ============================================================

-- ------------------------------------------------------------
-- prioridade do projeto
-- ------------------------------------------------------------
alter table public.projects
  add column priority smallint not null default 2 check (priority between 0 and 3);

-- ------------------------------------------------------------
-- project_areas — departamentos de um projeto
-- ------------------------------------------------------------
create table public.project_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  priority smallint not null default 2 check (priority between 0 and 3),
  -- true: as tarefas seguem uma ordem (1, 2, 3…) e só a primeira aberta é "a próxima"
  sequential boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_areas_project_idx on public.project_areas (user_id, project_id, position);

-- departamento só em projeto do mesmo usuário
create trigger project_areas_project_owner before insert or update of project_id on public.project_areas
  for each row execute function public.nucleo_check_project_owner();

-- ------------------------------------------------------------
-- tasks: departamento, posição na sequência e prioridade "agora" (0)
-- ------------------------------------------------------------
alter table public.tasks
  add column area_id uuid references public.project_areas (id) on delete set null,
  add column sequence int check (sequence is null or sequence >= 0);
create index tasks_area_seq_idx on public.tasks (area_id, sequence) where area_id is not null;

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check (priority between 0 and 3);

/*
 * Departamento manda no projeto: tarefa num departamento fica no projeto dele.
 * Trocar a tarefa de projeto (sem trocar o departamento) tira ela do departamento antigo.
 * Nome com "a_" para rodar antes de tasks_project_owner (triggers rodam em ordem alfabética).
 */
create or replace function public.nucleo_sync_task_area()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  area_project uuid;
begin
  if tg_op = 'UPDATE'
     and new.project_id is distinct from old.project_id
     and new.area_id is not distinct from old.area_id then
    new.area_id := null;
  end if;
  if new.area_id is not null then
    select a.project_id into area_project
      from public.project_areas a
     where a.id = new.area_id and a.user_id = new.user_id;
    if area_project is null then
      raise exception 'departamento não pertence ao usuário';
    end if;
    new.project_id := area_project;
  end if;
  return new;
end;
$$;

create trigger tasks_a_area_sync before insert or update of area_id, project_id on public.tasks
  for each row execute function public.nucleo_sync_task_area();

-- ------------------------------------------------------------
-- updated_at + RLS
-- ------------------------------------------------------------
create trigger project_areas_updated_at before update on public.project_areas
  for each row execute function public.nucleo_set_updated_at();
alter table public.project_areas enable row level security;
create policy project_areas_select_own on public.project_areas for select to authenticated using ((select auth.uid()) = user_id);
create policy project_areas_insert_own on public.project_areas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy project_areas_update_own on public.project_areas for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy project_areas_delete_own on public.project_areas for delete to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.project_areas;
  end if;
end;
$$;
