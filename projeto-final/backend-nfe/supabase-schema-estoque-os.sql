-- SCHEMA: ESTOQUE E ORDENS DE SERVIÇO
-- Execute este SQL no SQL Editor do Supabase (após o schema principal)

-- ============================================================
-- TABELA: PRODUTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(100),
  unidade_medida VARCHAR(10) NOT NULL DEFAULT 'UN',
  preco_custo DECIMAL(10, 2) NOT NULL DEFAULT 0,
  preco_venda DECIMAL(10, 2) NOT NULL DEFAULT 0,
  estoque_atual INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  estoque_maximo INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_produtos_user_id ON produtos(user_id);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own produtos"
  ON produtos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABELA: MOVIMENTAÇÕES DE ESTOQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA', 'AJUSTE', 'VENDA', 'DEVOLUCAO')),
  quantidade INTEGER NOT NULL,
  estoque_anterior INTEGER NOT NULL,
  estoque_posterior INTEGER NOT NULL,
  motivo VARCHAR(255),
  documento_referencia VARCHAR(100),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_user_id ON movimentacoes_estoque(user_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_id ON movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_created_at ON movimentacoes_estoque(created_at);

ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own movimentacoes"
  ON movimentacoes_estoque FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABELA: ORDENS DE SERVIÇO
-- ============================================================
CREATE TABLE IF NOT EXISTS ordens_servico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  numero_os VARCHAR(20) NOT NULL,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  data_abertura DATE NOT NULL,
  data_fechamento DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'FATURADA', 'FATURADA_SEM_NF', 'CANCELADA')),
  valor_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  desconto DECIMAL(10, 2) DEFAULT 0,
  valor_final DECIMAL(10, 2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  nota_fiscal_id UUID REFERENCES notas_fiscais(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  faturado_em TIMESTAMP WITH TIME ZONE,
  faturado_por UUID REFERENCES auth.users(id),
  cancelado_em TIMESTAMP WITH TIME ZONE,
  cancelado_por UUID REFERENCES auth.users(id),
  motivo_cancelamento TEXT,
  UNIQUE(user_id, numero_os)
);

CREATE INDEX IF NOT EXISTS idx_os_user_id ON ordens_servico(user_id);
CREATE INDEX IF NOT EXISTS idx_os_venda_id ON ordens_servico(venda_id);
CREATE INDEX IF NOT EXISTS idx_os_cliente_id ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_data ON ordens_servico(data_abertura);

ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own ordens_servico"
  ON ordens_servico FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABELA: ITENS DA OS
-- ============================================================
CREATE TABLE IF NOT EXISTS itens_os (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id UUID REFERENCES ordens_servico(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  descricao VARCHAR(255) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10, 2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  estoque_baixado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_itens_os_os_id ON itens_os(os_id);
CREATE INDEX IF NOT EXISTS idx_itens_os_produto_id ON itens_os(produto_id);

ALTER TABLE itens_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage itens_os via ordens_servico"
  ON itens_os FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ordens_servico
      WHERE ordens_servico.id = itens_os.os_id
        AND ordens_servico.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ordens_servico
      WHERE ordens_servico.id = itens_os.os_id
        AND ordens_servico.user_id = auth.uid()
    )
  );
