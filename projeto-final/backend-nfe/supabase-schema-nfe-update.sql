-- Migração: adiciona colunas faltantes em notas_fiscais
ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS numero_nfe        INTEGER,
  ADD COLUMN IF NOT EXISTS destinatario_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS destinatario_doc  VARCHAR(18),
  ADD COLUMN IF NOT EXISTS destinatario_json JSONB,
  ADD COLUMN IF NOT EXISTS itens             JSONB,
  ADD COLUMN IF NOT EXISTS forma_pagamento   VARCHAR(5),
  ADD COLUMN IF NOT EXISTS xml_conteudo      TEXT,
  ADD COLUMN IF NOT EXISTS ambiente          VARCHAR(20) DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS hora_saida        VARCHAR(8),
  ADD COLUMN IF NOT EXISTS data_saida        DATE,
  ADD COLUMN IF NOT EXISTS natureza_operacao VARCHAR(120),
  ADD COLUMN IF NOT EXISTS protocolo_data    TIMESTAMPTZ;
