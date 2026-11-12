-- Limpeza única (NÃO é migration do NÚCLEO): remove os sistemas antigos chapelao_* e arte_*.
-- Aprovado pelo Peter em 2026-11-12. Não toca no schema `prospector` nem em public.leads/conversas/mensagens.
--
-- Segurança:
--  1. Tudo numa transação: se qualquer passo falhar, NADA é excluído.
--  2. Sem CASCADE: se alguma tabela que fica (ex.: prospector.*) depender de uma que sai,
--     o DROP falha e a transação é desfeita em vez de quebrar a outra tabela em silêncio.
--  3. Se alguma tabela tiver dados (fora arte_etapas, que é só configuração de etapas),
--     o script PARA e lista quais. Para excluir mesmo assim, troque `false` por `true` abaixo.

begin;

do $$
declare
  excluir_mesmo_com_dados constant boolean := false;  -- << troque para true se quiser apagar com dados
  r record;
  n bigint;
  com_dados text := '';
  views_list text;
  tables_list text;
begin
  -- 1) Checa dados
  for r in
    select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r'
      and (c.relname like 'chapelao\_%' or c.relname like 'arte\_%')
      and c.relname <> 'arte_etapas'
  loop
    execute format('select count(*) from public.%I', r.relname) into n;
    if n > 0 then com_dados := com_dados || format('%s (%s linhas), ', r.relname, n); end if;
  end loop;
  if com_dados <> '' and not excluir_mesmo_com_dados then
    raise exception 'Parado: estas tabelas têm dados: %. Nada foi excluído.', rtrim(com_dados, ', ');
  end if;

  -- 2) Views primeiro (dependem das tabelas)
  select string_agg(format('public.%I', c.relname), ', ') into views_list
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind in ('v', 'm')
    and (c.relname like 'chapelao\_%' or c.relname like 'arte\_%');
  if views_list is not null then
    execute 'drop view if exists ' || views_list;
    raise notice 'Views excluídas: %', views_list;
  end if;

  -- 3) Tabelas, todas num único DROP (resolve FKs entre elas, sem CASCADE)
  select string_agg(format('public.%I', c.relname), ', ') into tables_list
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind in ('r', 'p')
    and (c.relname like 'chapelao\_%' or c.relname like 'arte\_%');
  if tables_list is not null then
    execute 'drop table if exists ' || tables_list;
    raise notice 'Tabelas excluídas: %', tables_list;
  end if;
end;
$$;

commit;

-- Sobras (funções/tipos com prefixo chapelao_/arte_). Só lista; não exclui.
select 'função' as tipo, p.proname as nome
from pg_proc p join pg_namespace s on s.oid = p.pronamespace
where s.nspname = 'public' and (p.proname like 'chapelao\_%' or p.proname like 'arte\_%')
union all
select 'tipo', t.typname
from pg_type t join pg_namespace s on s.oid = t.typnamespace
where s.nspname = 'public' and t.typtype in ('e', 'c', 'd')
  and (t.typname like 'chapelao\_%' or t.typname like 'arte\_%')
union all
select 'restantes chapelao_/arte_', count(*)::text
from pg_class c join pg_namespace s on s.oid = c.relnamespace
where s.nspname = 'public' and (c.relname like 'chapelao\_%' or c.relname like 'arte\_%');
