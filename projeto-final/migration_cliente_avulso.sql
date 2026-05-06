-- Migration: suporte a cliente avulso na venda + cliente_nome/telefone na OS
-- Execute no SQL Editor do Supabase

-- Adiciona colunas de cliente avulso na tabela vendas
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20);

-- Adiciona colunas de cliente na tabela ordens_servico (para exibir na impressão)
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20);
