# 🔥 GUIA COMPLETO: INTEGRAÇÃO COM SUPABASE + NF-e

## 📋 Índice
1. [Configuração do Supabase](#1-configuração-do-supabase)
2. [Autenticação de Usuários](#2-autenticação-de-usuários)
3. [Banco de Dados](#3-banco-de-dados)
4. [Integração com o Sistema](#4-integração-com-o-sistema)
5. [Emissão de NF-e](#5-emissão-de-nf-e)
6. [Deploy e Produção](#6-deploy-e-produção)

---

## 1. CONFIGURAÇÃO DO SUPABASE

### **Passo 1.1: Criar Conta no Supabase**

1. Acesse: https://supabase.com
2. Clique em "Start your project"
3. Faça login com GitHub ou email
4. Crie uma nova organização (nome da sua empresa)
5. Crie um novo projeto:
   - **Project name:** sistema-gestao
   - **Database Password:** Anote bem! (min. 12 caracteres)
   - **Region:** South America (sao-paulo)
   - Clique em "Create new project"

⏱️ Aguarde 2-3 minutos enquanto o Supabase provisiona seu banco de dados.

### **Passo 1.2: Obter Credenciais**

No painel do Supabase, vá em **Settings > API**:

```bash
# Você precisará de:
PROJECT_URL=https://xxxxxxxxxxxxx.supabase.co
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (SEGREDO!)
```

### **Passo 1.3: Instalar Dependências**

No seu projeto:

```bash
npm install @supabase/supabase-js
npm install @supabase/auth-helpers-react
```

### **Passo 1.4: Criar Arquivo de Configuração**

Crie `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANTE:** Adicione `.env.local` ao `.gitignore`!

---

## 2. AUTENTICAÇÃO DE USUÁRIOS

### **Passo 2.1: Criar Cliente Supabase**

Crie `src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### **Passo 2.2: Criar Store de Autenticação**

Crie `src/store/authStore.js`:

```javascript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,

  // Inicializar autenticação
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null, loading: false });

      // Listener para mudanças de autenticação
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    } catch (error) {
      console.error('Erro ao inicializar auth:', error);
      set({ loading: false });
    }
  },

  // Login
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      set({ session: data.session, user: data.user });
      toast.success('Login realizado com sucesso!');
      return { success: true };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error };
    }
  },

  // Registro
  signUp: async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata, // nome, empresa, etc
        },
      });

      if (error) throw error;

      toast.success('Cadastro realizado! Verifique seu email.');
      return { success: true };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error };
    }
  },

  // Logout
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set({ session: null, user: null });
      toast.success('Logout realizado!');
    } catch (error) {
      toast.error(error.message);
    }
  },

  // Reset de senha
  resetPassword: async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success('Email de recuperação enviado!');
      return { success: true };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error };
    }
  },
}));

export default useAuthStore;
```

### **Passo 2.3: Criar Componente de Login**

Crie `src/components/auth/LoginForm.jsx`:

```javascript
import React, { useState } from 'react';
import { LogIn, Mail, Lock } from 'lucide-react';
import useAuthStore from '@store/authStore';
import Button from '@components/common/Button';
import Input from '@components/common/Input';

const LoginForm = ({ onToggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    await signIn(email, password);

    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Sistema de Gestão</h1>
        <p className="text-slate-600 mt-2">Faça login para continuar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          icon={<Mail className="w-5 h-5 text-slate-400" />}
        />

        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          icon={<Lock className="w-5 h-5 text-slate-400" />}
        />

        <Button
          type="submit"
          className="w-full"
          icon={LogIn}
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={onToggleMode}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          Não tem conta? Cadastre-se
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
```

### **Passo 2.4: Proteger Rotas**

Crie `src/components/auth/ProtectedRoute.jsx`:

```javascript
import React, { useEffect } from 'react';
import useAuthStore from '@store/authStore';

const ProtectedRoute = ({ children }) => {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return children;
};

export default ProtectedRoute;
```

### **Passo 2.5: Atualizar App.jsx**

```javascript
import React from 'react';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from '@components/auth/ProtectedRoute';
// ... resto dos imports

function App() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Toaster position="top-right" />
        {/* Resto do app */}
      </div>
    </ProtectedRoute>
  );
}

export default App;
```

---

## 3. BANCO DE DADOS

### **Passo 3.1: Criar Tabelas no Supabase**

No painel do Supabase, vá em **Database > SQL Editor** e execute:

```sql
-- Habilitar RLS (Row Level Security)
-- Isso garante que cada usuário só veja seus próprios dados

-- Tabela de Clientes
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(18) NOT NULL,
  telefone VARCHAR(15) NOT NULL,
  email VARCHAR(255) NOT NULL,
  endereco TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabela de Vendas
CREATE TABLE vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  produtos TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('Pago', 'Pendente')),
  forma_pagamento VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabela de Recebimentos
CREATE TABLE recebimentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao TEXT NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabela de Pagamentos
CREATE TABLE pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao TEXT NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('Pago', 'Pendente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabela de Notas Fiscais
CREATE TABLE notas_fiscais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  numero VARCHAR(20) NOT NULL,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  cliente VARCHAR(255) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('NF-e', 'NFC-e', 'NFS-e')),
  chave_acesso VARCHAR(44), -- Chave de acesso da NF-e
  xml_path TEXT, -- Caminho do XML armazenado
  status VARCHAR(20) DEFAULT 'Emitida',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, numero)
);

-- Índices para melhor performance
CREATE INDEX idx_clientes_user_id ON clientes(user_id);
CREATE INDEX idx_vendas_user_id ON vendas(user_id);
CREATE INDEX idx_vendas_cliente_id ON vendas(cliente_id);
CREATE INDEX idx_recebimentos_user_id ON recebimentos(user_id);
CREATE INDEX idx_pagamentos_user_id ON pagamentos(user_id);
CREATE INDEX idx_notas_fiscais_user_id ON notas_fiscais(user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON vendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recebimentos_updated_at BEFORE UPDATE ON recebimentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notas_fiscais_updated_at BEFORE UPDATE ON notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **Passo 3.2: Configurar Row Level Security (RLS)**

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para CLIENTES
CREATE POLICY "Usuários podem ver apenas seus clientes"
  ON clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus clientes"
  ON clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus clientes"
  ON clientes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus clientes"
  ON clientes FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas de segurança para VENDAS
CREATE POLICY "Usuários podem ver apenas suas vendas"
  ON vendas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas vendas"
  ON vendas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas vendas"
  ON vendas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas vendas"
  ON vendas FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas de segurança para RECEBIMENTOS
CREATE POLICY "Usuários podem ver apenas seus recebimentos"
  ON recebimentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus recebimentos"
  ON recebimentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus recebimentos"
  ON recebimentos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus recebimentos"
  ON recebimentos FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas de segurança para PAGAMENTOS
CREATE POLICY "Usuários podem ver apenas seus pagamentos"
  ON pagamentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus pagamentos"
  ON pagamentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus pagamentos"
  ON pagamentos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus pagamentos"
  ON pagamentos FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas de segurança para NOTAS FISCAIS
CREATE POLICY "Usuários podem ver apenas suas notas fiscais"
  ON notas_fiscais FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas notas fiscais"
  ON notas_fiscais FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas notas fiscais"
  ON notas_fiscais FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas notas fiscais"
  ON notas_fiscais FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 4. INTEGRAÇÃO COM O SISTEMA

### **Passo 4.1: Atualizar Store de Clientes**

Substitua `src/store/clienteStore.js`:

```javascript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const useClienteStore = create((set, get) => ({
  clientes: [],
  loading: false,

  // Buscar todos os clientes do usuário
  fetchClientes: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ clientes: data || [], loading: false });
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes');
      set({ loading: false });
    }
  },

  // Adicionar cliente
  addCliente: async (cliente) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('clientes')
        .insert([{ ...cliente, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        clientes: [data, ...state.clientes]
      }));

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      toast.error('Erro ao adicionar cliente');
      return { success: false, error };
    }
  },

  // Atualizar cliente
  updateCliente: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        clientes: state.clientes.map((c) => (c.id === id ? data : c))
      }));

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
      return { success: false, error };
    }
  },

  // Deletar cliente
  deleteCliente: async (id) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        clientes: state.clientes.filter((c) => c.id !== id)
      }));

      return { success: true };
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      toast.error('Erro ao deletar cliente');
      return { success: false, error };
    }
  },

  // Buscar cliente por ID
  getClienteById: (id) => {
    return get().clientes.find((c) => c.id === id);
  },

  // Buscar clientes
  searchClientes: (searchTerm) => {
    const clientes = get().clientes;
    if (!searchTerm) return clientes;

    const term = searchTerm.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.cpf_cnpj.includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  },
}));

export default useClienteStore;
```

### **Passo 4.2: Atualizar Página de Clientes**

Atualize `src/pages/Clientes.jsx` para chamar `fetchClientes`:

```javascript
// Adicione no componente
import { useEffect } from 'react';

const Clientes = () => {
  const { clientes, fetchClientes, addCliente, updateCliente, deleteCliente } = useClienteStore();

  // Buscar clientes ao montar componente
  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Resto do código...
}
```

### **Passo 4.3: Padrão para Outras Stores**

Siga o mesmo padrão para atualizar:
- `vendaStore.js`
- `recebimentoStore.js`
- `pagamentoStore.js`
- `notaFiscalStore.js`

**IMPORTANTE:** Sempre:
1. Adicione `user_id` nas inserções
2. Use `fetchXxx()` para buscar dados
3. Atualize o estado local após operações
4. Trate erros adequadamente

---

## 5. EMISSÃO DE NF-e

### **Opção 1: API de Nota Fiscal (Recomendado)**

Use um serviço especializado como:

#### **A) Focus NFe** (Mais popular)
- Site: https://focusnfe.com.br
- Preço: R$ 0,25 por NF-e
- Fácil integração
- Documentação excelente

#### **B) Bling**
- Site: https://www.bling.com.br
- ERP completo com NF-e incluída
- Integração via API

#### **C) eNotas**
- Site: https://enotas.com.br
- Especializado em NF-e/NFS-e

### **Passo 5.1: Instalar SDK Focus NFe**

```bash
npm install axios
```

### **Passo 5.2: Criar Serviço de NF-e**

Crie `src/services/nfeService.js`:

```javascript
import axios from 'axios';

const FOCUS_NFE_TOKEN = import.meta.env.VITE_FOCUS_NFE_TOKEN;
const FOCUS_NFE_ENV = import.meta.env.VITE_FOCUS_NFE_ENV || 'homologacao'; // homologacao ou producao

const api = axios.create({
  baseURL: `https://${FOCUS_NFE_ENV === 'producao' ? 'api' : 'homologacao'}.focusnfe.com.br`,
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: FOCUS_NFE_TOKEN,
    password: '',
  },
});

export const nfeService = {
  // Emitir NF-e
  emitirNFe: async (dadosNFe) => {
    try {
      const response = await api.post('/v2/nfe', dadosNFe);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Erro ao emitir NF-e:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  },

  // Consultar NF-e
  consultarNFe: async (ref) => {
    try {
      const response = await api.get(`/v2/nfe/${ref}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Erro ao consultar NF-e:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  },

  // Cancelar NF-e
  cancelarNFe: async (ref, justificativa) => {
    try {
      const response = await api.delete(`/v2/nfe/${ref}`, {
        data: { justificativa },
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Erro ao cancelar NF-e:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  },

  // Download XML
  downloadXML: async (ref) => {
    try {
      const response = await api.get(`/v2/nfe/${ref}/xml`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Erro ao baixar XML:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  },

  // Download DANFE (PDF)
  downloadDANFE: async (ref) => {
    try {
      const response = await api.get(`/v2/nfe/${ref}/danfe`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Erro ao baixar DANFE:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  },
};
```

### **Passo 5.3: Exemplo de Emissão de NF-e**

```javascript
// Estrutura de dados para emitir NF-e
const dadosNFe = {
  natureza_operacao: "Venda de mercadoria",
  data_emissao: "2026-02-09T10:00:00-03:00",
  tipo_documento: "1", // 0=entrada, 1=saida
  finalidade_emissao: "1", // 1=Normal
  cnpj_emitente: "51916585000125", // Seu CNPJ
  
  // Dados do destinatário
  nome_destinatario: cliente.nome,
  cpf_destinatario: cliente.cpfCnpj, // ou cnpj_destinatario
  telefone_destinatario: cliente.telefone,
  logradouro_destinatario: "Rua Exemplo",
  numero_destinatario: "123",
  bairro_destinatario: "Centro",
  municipio_destinatario: "Curitiba",
  uf_destinatario: "PR",
  cep_destinatario: "80000000",
  
  // Itens da nota
  items: [
    {
      numero_item: "1",
      codigo_produto: "001",
      descricao: venda.produtos,
      cfop: "5102", // Venda de mercadoria
      unidade_comercial: "UN",
      quantidade_comercial: 1,
      valor_unitario_comercial: venda.valor,
      valor_bruto: venda.valor,
      
      // Tributos (exemplo simplificado - consulte contador)
      icms_origem: "0",
      icms_situacao_tributaria: "102", // Simples Nacional
      pis_situacao_tributaria: "07",
      cofins_situacao_tributaria: "07",
    }
  ],
  
  // Formas de pagamento
  formas_pagamento: [
    {
      forma_pagamento: "01", // Dinheiro
      valor_pagamento: venda.valor,
    }
  ],
};

// Emitir
const result = await nfeService.emitirNFe(dadosNFe);

if (result.success) {
  // Salvar chave de acesso no banco
  await updateNotaFiscal(notaId, {
    chave_acesso: result.data.chave_nfe,
    status: 'Autorizada',
  });
}
```

### **Passo 5.4: Configurar Certificado Digital**

⚠️ **IMPORTANTE:** Para emitir NF-e em produção, você precisa:

1. **Certificado Digital e-CNPJ** (A1 ou A3)
2. **Cadastro na SEFAZ** do seu estado
3. **Credenciais de acesso** ao webservice

A Focus NFe gerencia isso para você - basta cadastrar o certificado no painel deles.

---

## 6. DEPLOY E PRODUÇÃO

### **Passo 6.1: Deploy no Vercel**

```bash
# Instalar Vercel CLI
npm install -g vercel

# Fazer deploy
vercel

# Configurar variáveis de ambiente no painel Vercel:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_FOCUS_NFE_TOKEN
# - VITE_FOCUS_NFE_ENV
```

### **Passo 6.2: Configurar Domínio Personalizado**

No painel Vercel:
1. Settings > Domains
2. Adicione seu domínio (ex: meugestao.com.br)
3. Configure DNS conforme instruções

### **Passo 6.3: Configurar Callbacks no Supabase**

No Supabase, vá em **Authentication > URL Configuration**:

```
Site URL: https://meugestao.com.br
Redirect URLs: 
  - https://meugestao.com.br
  - http://localhost:3000 (para desenvolvimento)
```

---

## 📚 RECURSOS ADICIONAIS

### **Documentação:**
- Supabase: https://supabase.com/docs
- Focus NFe: https://focusnfe.com.br/doc
- NF-e SEFAZ: https://www.nfe.fazenda.gov.br

### **Bibliotecas Úteis:**
```bash
# Upload de arquivos
npm install @supabase/storage-js

# Geração de PDF
npm install jspdf jspdf-autotable

# Validação de CPF/CNPJ
npm install @fnando/cpf @fnando/cnpj
```

---

## ✅ CHECKLIST FINAL

- [ ] Conta Supabase criada
- [ ] Banco de dados configurado
- [ ] RLS policies aplicadas
- [ ] Autenticação funcionando
- [ ] Stores integradas com Supabase
- [ ] Conta Focus NFe criada (homologação)
- [ ] Serviço de NF-e implementado
- [ ] Teste de emissão em homologação
- [ ] Certificado digital obtido
- [ ] Deploy em produção
- [ ] Domínio configurado
- [ ] Variáveis de ambiente configuradas
- [ ] NF-e em produção testada

---

**🎉 Pronto! Seu sistema agora está completo com:**
- ✅ Autenticação segura
- ✅ Banco de dados na nuvem
- ✅ Dados isolados por usuário
- ✅ Emissão de NF-e oficial
- ✅ Pronto para produção!
