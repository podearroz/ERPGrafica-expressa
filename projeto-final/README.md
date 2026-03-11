# 🚀 SISTEMA DE GESTÃO COMPLETO - PRONTO PARA USO

## ✨ O QUE VOCÊ TEM AQUI

**Sistema 100% FUNCIONAL** com:
- ✅ **Frontend React** completo com todas as páginas (Dashboard, Clientes, Vendas, Recebimentos, Pagamentos, Notas Fiscais, Relatórios)
- ✅ **Backend Node.js** para emissão de NF-e integrado com SEFAZ Rondônia
- ✅ **Supabase** como banco de dados e autenticação
- ✅ **Emissão de NF-e** com certificado digital

---

## 📁 ESTRUTURA DO PROJETO

```
projeto-final/
├── frontend/              # Sistema React
│   ├── src/
│   │   ├── components/   # Componentes reutilizáveis
│   │   ├── pages/        # Páginas completas
│   │   ├── store/        # Zustand stores
│   │   └── services/     # Serviços e APIs
│   └── package.json
│
└── backend-nfe/          # API de NF-e
    ├── src/
    │   ├── config/       # Configurações SEFAZ
    │   ├── controllers/  # Endpoints da API
    │   ├── services/     # Lógica de negócio
    │   ├── routes/       # Rotas
    │   └── utils/        # Utilitários
    ├── certificados/     # COLOQUE SEU CERTIFICADO.PFX AQUI
    ├── storage/          # XMLs e PDFs gerados
    └── package.json
```

---

## 🚀 INSTALAÇÃO RÁPIDA

### PASSO 1: Extrair o Projeto
```bash
# Extrair o arquivo
tar -xzf projeto-final.tar.gz
cd projeto-final
```

### PASSO 2: Configurar o Backend NF-e

```bash
cd backend-nfe

# 1. Copie o .env.example para .env
cp .env.example .env

# 2. Edite o .env com seus dados REAIS
nano .env  # ou use seu editor preferido

# 3. IMPORTANTE: Coloque seu certificado digital
# Copie seu certificado.pfx para: certificados/certificado.pfx

# 4. Instalar dependências
npm install

# 5. Testar
npm run dev
```

**O backend deve iniciar na porta 3001**

### PASSO 3: Configurar o Frontend

```bash
# Em outro terminal
cd projeto-final/frontend

# 1. Copie o .env.example para .env.local
cp .env.example .env.local

# 2. Edite com suas credenciais do Supabase
nano .env.local

# 3. Instalar dependências
npm install

# 4. Rodar
npm run dev
```

**O frontend abre em http://localhost:3000**

---

## ⚙️ CONFIGURAÇÃO DO .ENV (Backend)

Edite `backend-nfe/.env`:

```env
# Ambiente
NODE_ENV=homologacao  # Mude para 'producao' quando pronto

# Certificado
CERTIFICADO_PATH=./certificados/certificado.pfx
CERTIFICADO_SENHA=SUA_SENHA_CERTIFICADO_AQUI

# Dados da sua empresa
EMPRESA_CNPJ=12345678000190  # SEU CNPJ
EMPRESA_RAZAO_SOCIAL=SUA EMPRESA LTDA
EMPRESA_NOME_FANTASIA=Sua Empresa
EMPRESA_IE=123456789  # Inscrição Estadual RO

# Endereço (Porto Velho como exemplo)
EMPRESA_LOGRADOURO=Avenida Sete de Setembro
EMPRESA_NUMERO=123
EMPRESA_BAIRRO=Centro
EMPRESA_CODIGO_MUNICIPIO=1100205  # Porto Velho
EMPRESA_MUNICIPIO=Porto Velho
EMPRESA_UF=RO
EMPRESA_CEP=76801000

# Contato
EMPRESA_TELEFONE=6933334444
EMPRESA_EMAIL=contato@suaempresa.com.br

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR...
```

---

## 🗄️ CONFIGURAÇÃO DO SUPABASE

### 1. Criar Conta no Supabase
- Acesse: https://supabase.com
- Crie uma conta gratuita
- Crie um novo projeto

### 2. Executar SQL para Criar Tabelas

No painel do Supabase, vá em **SQL Editor** e execute:

```sql
-- Ver arquivo: backend-nfe/supabase-schema.sql
-- (arquivo incluído no projeto)
```

### 3. Obter Credenciais

Em **Settings > API**, copie:
- `Project URL` → SUPABASE_URL
- `anon/public key` → SUPABASE_KEY

Cole essas credenciais nos arquivos `.env`

---

## 📜 CERTIFICADO DIGITAL

### Onde colocar:
```
backend-nfe/certificados/certificado.pfx
```

### Formato aceito:
- **.pfx** ou **.p12**
- Certificado e-CNPJ A1

### Onde comprar:
- Serasa Experian
- Certisign
- Soluti
- Valid

**Custo:** R$ 200-300/ano

---

## 🧪 TESTANDO O SISTEMA

### 1. Testar Backend

```bash
cd backend-nfe
npm run dev

# Abra outro terminal e teste:
curl http://localhost:3001/health

# Deve retornar:
{
  "status": "OK",
  "ambiente": "homologacao",
  "uf": "RO"
}
```

### 2. Testar Frontend

Acesse: http://localhost:3000

1. Cadastre um cliente
2. Faça uma venda
3. Emita uma NF-e (em homologação)

---

## 📤 EMITINDO SUA PRIMEIRA NF-e

### Teste via API (Postman ou curl):

```bash
POST http://localhost:3001/api/nfe/emitir
Content-Type: application/json

{
  "venda": {
    "numero": 1,
    "valor": 100.00,
    "produtos": "Produto Teste Homologação",
    "formaPagamento": "Dinheiro"
  },
  "cliente": {
    "nome": "Cliente Teste NF",
    "cpfCnpj": "12345678901",
    "telefone": "69999999999",
    "logradouro": "Rua Teste",
    "numero": "123",
    "bairro": "Centro",
    "municipio": "Porto Velho",
    "uf": "RO",
    "cep": "76801000",
    "codigoMunicipio": "1100205"
  },
  "empresa": {
    "cnpj": "SEU_CNPJ_AQUI",
    "razaoSocial": "SUA EMPRESA LTDA",
    "nomeFantasia": "Sua Empresa",
    "ie": "123456789",
    "logradouro": "Av Teste",
    "numero": "456",
    "bairro": "Centro",
    "municipio": "Porto Velho",
    "uf": "RO",
    "cep": "76801000",
    "codigoMunicipio": "1100205",
    "telefone": "6933334444",
    "crt": "1"
  }
}
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "chaveAcesso": "11260212345678000190550010000000011234567890",
    "numero": 1,
    "serie": "1",
    "protocolo": "111222333444555",
    "dataAutorizacao": "2026-02-11T15:30:00-04:00"
  }
}
```

---

## 🔄 MIGRANDO PARA PRODUÇÃO

Quando estiver tudo testado:

1. **Obtenha certificado VÁLIDO** (não pode ser o de teste)
2. **Mude o .env:**
   ```env
   NODE_ENV=producao
   ```
3. **Reinicie o backend**
4. **Emita NF-e real**
5. **Configure backup automático** dos XMLs

---

## 📊 FUNCIONALIDADES DO SISTEMA

### ✅ Dashboard
- Métricas em tempo real
- Vendas recentes
- Pagamentos pendentes
- Saldo atual

### ✅ Clientes
- CRUD completo
- Busca e filtros
- Validação de CPF/CNPJ

### ✅ Vendas
- Vinculação com clientes
- Múltiplas formas de pagamento
- Status (Pago/Pendente)

### ✅ Recebimentos
- Entrada/Saída
- Categorização
- Relatórios por categoria

### ✅ Pagamentos
- Controle de status
- Alertas de vencimento
- Categorização

### ✅ Notas Fiscais
- Emissão automática via API
- Numeração sequencial
- Download XML e DANFE
- Cancelamento

### ✅ Relatórios
- Análises financeiras
- Gráficos
- Exportação

---

## 🆘 TROUBLESHOOTING

### Erro: "Certificado não encontrado"
```bash
# Verifique se o arquivo existe:
ls -la backend-nfe/certificados/

# Verifique o caminho no .env:
CERTIFICADO_PATH=./certificados/certificado.pfx
```

### Erro: "SEFAZ indisponível"
- Verifique sua conexão com internet
- SEFAZ pode estar em manutenção (geralmente madrugada)
- Verifique se está usando URLs corretas de RO

### Erro: "Supabase connection failed"
- Verifique credenciais no .env
- Verifique se executou o SQL schema
- Verifique se o projeto Supabase está ativo

### Porta 3000 ou 3001 já em uso
```bash
# Mudar porta no .env (backend)
PORT=3002

# Mudar porta no vite.config.js (frontend)
server: { port: 3001 }
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

Arquivos incluídos no projeto:
- ✅ `GUIA_SUPABASE_NFE.md` - Integração completa Supabase
- ✅ `CONFIGURAR_NFE_RONDONIA.md` - Setup específico RO
- ✅ `CODIGOS_COMPLETOS_NFE_RO.md` - Referência de código

---

## 💰 CUSTOS

### Obrigatórios:
- **Certificado Digital:** R$ 200-300/ano

### Opcionais (tudo tem plano gratuito):
- **Supabase:** Grátis até 500MB
- **Hospedagem Frontend:** Grátis (Vercel/Netlify)
- **Hospedagem Backend:** Grátis (Railway/Render)

**Total mínimo:** R$ 200-300/ano (só certificado)

---

## ✅ CHECKLIST DE PRODUÇÃO

Antes de ir para produção:

- [ ] Certificado digital válido instalado
- [ ] Pelo menos 20 NF-e emitidas em homologação
- [ ] Todas as funcionalidades testadas
- [ ] Backup configurado
- [ ] .env com dados corretos
- [ ] NODE_ENV=producao
- [ ] Domínio configurado (opcional)
- [ ] SSL/HTTPS configurado (se usar domínio)

---

## 🎉 PRONTO!

Seu sistema está completo e funcional!

**Dúvidas?** Consulte os guias incluídos no projeto.

**Bom uso! 🚀**
