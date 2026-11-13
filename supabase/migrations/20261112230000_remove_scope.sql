-- NÚCLEO · remove a separação arte/pessoal (`scope`).
-- O Peter trabalha como autônomo, sem empresa/CNPJ: é um dinheiro só.
-- Custo do trabalho (ferramentas, anúncios) sai das categorias, não de uma etiqueta.

alter table public.categories drop column if exists scope_default;
drop type if exists public.scope;

update public.categories set name = 'Anúncios', updated_at = now()
where name = 'Anúncios (ARTe)';

create or replace function public.nucleo_seed_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, kind, icon, color_token)
  values
    (p_user_id, 'Receita de cliente',      'income',  'handshake',      'volt'),
    (p_user_id, 'Setup/implantação',       'income',  'wrench',         'volt'),
    (p_user_id, 'Outras receitas',         'income',  'plus-circle',    'volt'),
    (p_user_id, 'Alimentação',             'expense', 'utensils',       'flare'),
    (p_user_id, 'Transporte/Combustível',  'expense', 'fuel',           'flare'),
    (p_user_id, 'Moradia',                 'expense', 'home',           'flare'),
    (p_user_id, 'Assinaturas/Ferramentas', 'expense', 'app-window',     'flare'),
    (p_user_id, 'Anúncios',                'expense', 'megaphone',      'flare'),
    (p_user_id, 'Lazer',                   'expense', 'party-popper',   'flare'),
    (p_user_id, 'Saúde',                   'expense', 'heart-pulse',    'flare'),
    (p_user_id, 'Roupas',                  'expense', 'shirt',          'flare'),
    (p_user_id, 'Educação',                'expense', 'graduation-cap', 'flare'),
    (p_user_id, 'Outros',                  'expense', 'circle-dashed',  'flare')
  on conflict (user_id, kind, name) do nothing;
end;
$$;

revoke all on function public.nucleo_seed_user_defaults(uuid) from public, anon, authenticated;
