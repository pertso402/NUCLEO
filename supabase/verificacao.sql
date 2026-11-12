-- Verificação SOMENTE LEITURA (não altera nada).
-- 1) contagem EXATA de linhas em cada tabela chapelao_/arte_
-- 2) dependências de fora (FK de outra tabela apontando para elas)
-- 3) nomes que a migration do NÚCLEO vai criar e que já existem
-- 4) quantos usuários existem no Auth
with alvo as (
  select c.oid, c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (c.relname like 'chapelao\_%' or c.relname like 'arte\_%')
),
contagem as (
  select relname as item,
         (xpath('/row/n/text()',
                query_to_xml(format('select count(*) as n from public.%I', relname), false, true, '')))[1]::text::bigint as valor,
         'linhas' as tipo
  from alvo
),
fks_externas as (
  select conrelid::regclass::text || ' -> ' || confrelid::regclass::text as item, null::bigint as valor,
         'FK de fora apontando p/ tabela que seria excluída' as tipo
  from pg_constraint
  where contype = 'f'
    and confrelid in (select oid from alvo)
    and conrelid not in (select oid from alvo)
),
colisoes as (
  select n.nspname || '.' || c.relname as item, null::bigint, 'TABELA já existe com nome do NÚCLEO' from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('settings','principles','categories','inbox_messages')
  union all
  select 'tipo public.' || typname, null, 'TIPO já existe com nome do NÚCLEO' from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and typname in ('money_kind','scope','capture_channel','inbox_status')
  union all
  select 'função public.' || proname, null, 'FUNÇÃO já existe com nome do NÚCLEO' from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and proname like 'nucleo\_%'
),
auth_users as (
  select 'auth.users' as item, count(*)::bigint as valor, 'usuários no Auth' as tipo from auth.users
)
select * from contagem where valor > 0
union all select * from fks_externas
union all select * from colisoes
union all select * from auth_users
union all select 'tabelas chapelao_/arte_ VAZIAS', count(*), 'linhas = 0' from contagem where valor = 0
order by tipo, item;
