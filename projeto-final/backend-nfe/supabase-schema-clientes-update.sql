-- Migração: adiciona campo inscricao_estadual na tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(20);
