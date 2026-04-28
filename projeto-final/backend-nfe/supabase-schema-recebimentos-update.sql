-- ATUALIZAÇÃO: Adiciona campos de status e controle ao recebimentos
-- Execute no SQL Editor do Supabase

ALTER TABLE recebimentos
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Não Pago'
    CHECK (status IN ('Recebido', 'Parcelado', 'Não Pago')),
  ADD COLUMN IF NOT EXISTS forma_recebimento VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_recebimento DATE,
  ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parcelas INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_atual INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_recebimentos_status ON recebimentos(status);
CREATE INDEX IF NOT EXISTS idx_recebimentos_os_id ON recebimentos(os_id);

SELECT 'Tabela recebimentos atualizada!' AS status;
