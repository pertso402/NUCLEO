-- NÚCLEO · migration inicial (Fase 0.5)
-- settings, principles, categories (seed), inbox_messages + RLS + trigger updated_at

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
create type public.money_kind as enum ('income', 'expense');
create type public.scope as enum ('arte', 'pessoal');
create type public.capture_channel as enum ('whatsapp', 'siri', 'app', 'palette');
create type public.inbox_status as enum ('ok', 'needs_clarification', 'error', 'undone');

-- ------------------------------------------------------------
-- updated_at
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- settings (1 linha por usuário)
-- ------------------------------------------------------------
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  workdays int[] not null default '{1,2,3,4,5}',
  daily_outreach_goal int not null default 5 check (daily_outreach_goal >= 0),
  auto_outreach_goal boolean not null default true,
  daily_focus_minutes_goal int not null default 240 check (daily_focus_minutes_goal >= 0),
  default_conv_rates jsonb not null default '{"r1":0.30,"r2":0.40,"r3":0.70,"r4":0.35}',
  default_ticket_cents bigint check (default_ticket_cents is null or default_ticket_cents > 0),
  whatsapp_number text,
  briefing_morning_time time not null default '07:30',
  briefing_night_time time not null default '21:30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_one_per_user unique (user_id),
  constraint settings_workdays_valid check (workdays <@ '{0,1,2,3,4,5,6}'::int[])
);

-- ------------------------------------------------------------
-- principles
-- ------------------------------------------------------------
create table public.principles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index principles_user_position_idx on public.principles (user_id, position);

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind public.money_kind not null,
  scope_default public.scope,
  icon text,
  color_token text check (
    color_token is null
    or color_token in ('volt', 'plasma', 'ion', 'ember', 'flare', 'text-1', 'text-2')
  ),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_unique_name unique (user_id, kind, name)
);

-- ------------------------------------------------------------
-- inbox_messages (toda captura passa por aqui)
-- ------------------------------------------------------------
create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  channel public.capture_channel not null,
  raw_text text,
  audio_url text,
  parsed jsonb,
  result jsonb,
  status public.inbox_status not null,
  reply_text text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inbox_messages_user_created_idx on public.inbox_messages (user_id, created_at desc);
create index inbox_messages_user_channel_status_idx
  on public.inbox_messages (user_id, channel, status, created_at desc);

-- ------------------------------------------------------------
-- Triggers updated_at
-- ------------------------------------------------------------
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
create trigger principles_updated_at before update on public.principles
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger inbox_messages_updated_at before update on public.inbox_messages
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS: user_id = auth.uid() em select/insert/update/delete
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['settings', 'principles', 'categories', 'inbox_messages'] loop
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
-- Seed por usuário: settings + categorias padrão
-- (seed não pode depender de auth.uid() numa migration; roda ao criar o usuário)
-- ------------------------------------------------------------
create or replace function public.seed_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, kind, scope_default, icon, color_token)
  values
    (p_user_id, 'Receita de cliente',      'income',  'arte',    'handshake',      'volt'),
    (p_user_id, 'Setup/implantação',       'income',  'arte',    'wrench',         'volt'),
    (p_user_id, 'Outras receitas',         'income',  null,      'plus-circle',    'volt'),
    (p_user_id, 'Alimentação',             'expense', 'pessoal', 'utensils',       'flare'),
    (p_user_id, 'Transporte/Combustível',  'expense', 'pessoal', 'fuel',           'flare'),
    (p_user_id, 'Moradia',                 'expense', 'pessoal', 'home',           'flare'),
    (p_user_id, 'Assinaturas/Ferramentas', 'expense', 'arte',    'app-window',     'flare'),
    (p_user_id, 'Anúncios (ARTe)',         'expense', 'arte',    'megaphone',      'flare'),
    (p_user_id, 'Lazer',                   'expense', 'pessoal', 'party-popper',   'flare'),
    (p_user_id, 'Saúde',                   'expense', 'pessoal', 'heart-pulse',    'flare'),
    (p_user_id, 'Roupas',                  'expense', 'pessoal', 'shirt',          'flare'),
    (p_user_id, 'Educação',                'expense', 'pessoal', 'graduation-cap', 'flare'),
    (p_user_id, 'Outros',                  'expense', null,      'circle-dashed',  'flare')
  on conflict (user_id, kind, name) do nothing;
end;
$$;

revoke all on function public.seed_user_defaults(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_user_defaults(new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários que já existam antes desta migration também recebem o seed.
select public.seed_user_defaults(u.id) from auth.users u;
