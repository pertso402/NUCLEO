-- Checagem SOMENTE LEITURA: a migration inicial do NÚCLEO entrou inteira?
-- Esperado: todas as linhas com ok = true.
select 'tabelas (4)' as item,
       count(*) = 4 as ok, count(*)::text as valor
from pg_tables where schemaname = 'public'
  and tablename in ('settings','principles','categories','inbox_messages')
union all
select 'RLS ligado (4)', bool_and(rowsecurity), count(*) filter (where rowsecurity)::text
from pg_tables where schemaname = 'public'
  and tablename in ('settings','principles','categories','inbox_messages')
union all
select 'políticas (16)', count(*) = 16, count(*)::text
from pg_policies where schemaname = 'public'
  and tablename in ('settings','principles','categories','inbox_messages')
union all
select 'funções nucleo_ (3)', count(*) = 3, string_agg(proname, ', ')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname like 'nucleo\_%'
union all
select 'gatilhos updated_at (4)', count(*) = 4, count(*)::text
from pg_trigger where not tgisinternal and tgname like '%\_updated\_at'
  and tgrelid in ('public.settings'::regclass, 'public.principles'::regclass,
                  'public.categories'::regclass, 'public.inbox_messages'::regclass)
union all
select 'gatilho em auth.users', count(*) = 1, string_agg(tgname, ', ')
from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'nucleo_on_auth_user_created'
union all
select 'usuários no Auth', true, count(*)::text from auth.users;
