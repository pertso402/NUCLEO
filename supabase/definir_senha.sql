-- Define (ou troca) a senha de entrada no NÚCLEO.
-- 1. Troque SUA_SENHA_AQUI pela senha que você quer (mínimo 8 caracteres).
-- 2. Rode no SQL Editor do Supabase. Deve aparecer "1 row" / UPDATE 1.
-- 3. Apague a senha deste editor depois (não salve a query com ela).
update auth.users
set encrypted_password = extensions.crypt('SUA_SENHA_AQUI', extensions.gen_salt('bf')),
    updated_at = now()
where email = 'peterlincon14@gmail.com';
