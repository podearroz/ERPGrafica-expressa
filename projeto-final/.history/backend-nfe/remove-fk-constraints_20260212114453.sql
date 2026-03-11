-- REMOVER CONSTRAINTS DE FOREIGN KEY PARA user_id
-- Execute este SQL no SQL Editor do Supabase

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_user_id_fkey;
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_user_id_fkey;
ALTER TABLE recebimentos DROP CONSTRAINT IF EXISTS recebimentos_user_id_fkey;
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_user_id_fkey;
ALTER TABLE notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_user_id_fkey;

-- Tornar user_id NULLABLE
ALTER TABLE clientes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE vendas ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE recebimentos ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE pagamentos ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE notas_fiscais ALTER COLUMN user_id DROP NOT NULL;

SELECT 'Foreign keys removidas e user_id agora é nullable!' AS status;
