-- Migração: adiciona campos de produto detalhado em vendas
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS unidade        VARCHAR(10) DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS quantidade     DECIMAL(10,3) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS valor_unitario DECIMAL(10,2);

-- Preenche valor_unitario com o valor existente para registros antigos
UPDATE vendas SET valor_unitario = valor WHERE valor_unitario IS NULL;
