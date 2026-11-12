-- Inventário SOMENTE LEITURA do projeto (não altera nada).
-- Cole no SQL Editor do Supabase, rode e mande o resultado para o Claude.
select
  c.relname                                   as nome,
  n.nspname                                   as schema,
  case c.relkind when 'r' then 'tabela' when 'v' then 'view'
                 when 'm' then 'view mat.' when 'p' then 'tabela part.' end as tipo,
  greatest(c.reltuples::bigint, 0)            as linhas_aprox,
  (select string_agg(a.attname, ', ' order by a.attnum)
     from pg_attribute a
    where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as colunas,
  case
    when c.relname ilike '%chapel%'            then 'chapelao'
    when c.relname ilike '%arte%'              then 'arte'
    when c.relname in ('settings','principles','categories','inbox_messages',
                       'transactions','milestones','goals','tasks','habits','habit_logs',
                       'time_entries','leads','lead_events','outreach_logs',
                       'daily_reviews','weekly_reviews','push_subscriptions',
                       'recurring_rules','sync_state','holidays')
                                               then 'NOME USADO PELO NÚCLEO'
    else ''
  end                                         as marcador
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','v','m','p')
  and n.nspname not in ('pg_catalog','information_schema','auth','storage','realtime',
                        'supabase_functions','supabase_migrations','extensions','graphql',
                        'graphql_public','pgsodium','pgsodium_masks','vault','net','cron',
                        'pgbouncer','_realtime','_analytics','pg_toast')
order by marcador desc, schema, nome;

-- Triggers já existentes em auth.users (o NÚCLEO cria "on_auth_user_created"):
-- select tgname, tgrelid::regclass from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
