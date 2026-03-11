# ⚡ INSTALAÇÃO RÁPIDA - 10 MINUTOS

## 🎯 CHECKLIST ANTES DE COMEÇAR

Você precisa ter:
- [ ] Node.js 18+ instalado
- [ ] Certificado digital e-CNPJ (.pfx)
- [ ] Conta no Supabase (gratuita)
- [ ] Editor de código (VSCode recomendado)

---

## 📦 PASSO 1: EXTRAIR E INSTALAR

```bash
# 1. Extrair
tar -xzf projeto-final.tar.gz
cd projeto-final

# 2. Instalar BACKEND
cd backend-nfe
npm install

# 3. Instalar FRONTEND (em outro terminal)
cd ../frontend
npm install
```

---

## ⚙️ PASSO 2: CONFIGURAR SUPABASE

### 2.1. Criar Projeto Supabase

1. Acesse https://supabase.com
2. Faça login/cadastro
3. Clique em "New Project"
4. Preencha:
   - Nome: sistema-gestao
   - Database Password: [anote bem!]
   - Region: South America (São Paulo)
5. Aguarde ~2 minutos

### 2.2. Criar Tabelas

1. No painel do Supabase, clique em **SQL Editor**
2. Clique em **New Query**
3. Copie TODO o conteúdo do arquivo:
   ```
   backend-nfe/supabase-schema.sql
   ```
4. Cole no editor
5. Clique em **RUN** (ou F5)
6. Aguarde a mensagem de sucesso ✅

### 2.3. Obter Credenciais

1. No painel, vá em **Settings** → **API**
2. Copie:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 🔑 PASSO 3: CONFIGURAR BACKEND

```bash
cd backend-nfe

# 1. Copiar exemplo
cp .env.example .env

# 2. Editar (use nano, vim ou VSCode)
nano .env
```

### Edite o .env:

```env
# ========== IMPORTANTE ==========
NODE_ENV=homologacao

# ========== CERTIFICADO ==========
CERTIFICADO_PATH=./certificados/certificado.pfx
CERTIFICADO_SENHA=SUA_SENHA_REAL_AQUI

# ========== SUA EMPRESA ==========
EMPRESA_CNPJ=12345678000190  # SEU CNPJ
EMPRESA_RAZAO_SOCIAL=MINHA EMPRESA LTDA
EMPRESA_NOME_FANTASIA=Minha Empresa
EMPRESA_IE=123456789  # SUA IE DE RONDÔNIA

# ========== ENDEREÇO ==========
EMPRESA_LOGRADOURO=Avenida Sete de Setembro
EMPRESA_NUMERO=1000
EMPRESA_BAIRRO=Centro
EMPRESA_CODIGO_MUNICIPIO=1100205  # Porto Velho
EMPRESA_MUNICIPIO=Porto Velho
EMPRESA_UF=RO
EMPRESA_CEP=76801000

# ========== CONTATO ==========
EMPRESA_TELEFONE=6933331234
EMPRESA_EMAIL=contato@minhaempresa.com.br

# ========== SUPABASE ==========
SUPABASE_URL=https://xxxxx.supabase.co  # Cole aqui
SUPABASE_KEY=eyJhbGci...  # Cole aqui
```

### 3.1. CERTIFICADO DIGITAL

**IMPORTANTE:** Copie seu certificado.pfx para:
```bash
cp /caminho/do/seu/certificado.pfx certificados/certificado.pfx
```

---

## 🎨 PASSO 4: CONFIGURAR FRONTEND

```bash
cd ../frontend

# 1. Criar .env.local
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_NFE_API_URL=http://localhost:3001
EOF

# 2. Editar com suas credenciais do Supabase
nano .env.local
```

---

## 🚀 PASSO 5: RODAR!

### Terminal 1 - Backend:
```bash
cd backend-nfe
npm run dev
```

**Deve aparecer:**
```
╔════════════════════════════════════════╗
║   🚀 API NF-e - Rondônia             ║
╠════════════════════════════════════════╣
║   Porta: 3001                        ║
║   Ambiente: homologacao              ║
║   SEFAZ: RO                           ║
╚════════════════════════════════════════╝
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

**Deve abrir:** http://localhost:3000

---

## ✅ PASSO 6: TESTAR

### 6.1. Criar Conta
1. Abra http://localhost:3000
2. Clique em "Criar Conta"
3. Preencha email e senha
4. Faça login

### 6.2. Cadastrar Cliente
1. Vá em "Clientes"
2. Clique "Novo Cliente"
3. Preencha os dados
4. Salve

### 6.3. Fazer Venda
1. Vá em "Vendas"
2. Clique "Nova Venda"
3. Selecione o cliente
4. Preencha valor e produtos
5. Salve

### 6.4. Emitir NF-e (TESTE)
1. Vá em "Notas Fiscais"
2. Clique "Emitir NF-e"
3. Selecione a venda
4. Clique "Emitir"
5. Aguarde autorização ✅

**Se aparecer "NF-e autorizada" → SUCESSO! 🎉**

---

## 🐛 PROBLEMAS COMUNS

### "Certificado não encontrado"
```bash
# Verifique:
ls -la backend-nfe/certificados/

# Deve mostrar: certificado.pfx
```

### "Supabase connection failed"
```bash
# Verifique credenciais no .env
# Verifique se executou o SQL
# Teste credenciais em: https://supabase.com/dashboard
```

### "SEFAZ indisponível"
- Verifique internet
- SEFAZ pode estar em manutenção
- Tente novamente em alguns minutos

### Porta já em uso
```bash
# Mudar porta do backend:
# Edite backend-nfe/.env
PORT=3002

# Mudar porta do frontend:
# Edite frontend/.env.local
VITE_NFE_API_URL=http://localhost:3002
```

---

## 🎓 PRÓXIMOS PASSOS

1. ✅ Teste todas as funcionalidades
2. ✅ Emita pelo menos 10 NF-e em homologação
3. ✅ Leia a documentação completa (README.md)
4. ✅ Quando pronto, mude NODE_ENV=producao

---

## 📞 PRECISA DE AJUDA?

Consulte:
- `README.md` - Documentação completa
- `GUIA_SUPABASE_NFE.md` - Integração Supabase
- `CONFIGURAR_NFE_RONDONIA.md` - Setup RO específico

---

**Instalação completa! 🚀**

Tempo total: ~10 minutos
