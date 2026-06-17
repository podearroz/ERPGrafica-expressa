# Deploy do Backend NF-e no Railway

## Passos

### 1. Criar conta e projeto
1. Acesse https://railway.app e crie uma conta (pode usar GitHub)
2. Clique em **New Project → Deploy from GitHub repo**
3. Selecione o repositório do sistema
4. Na tela de configuração, defina o **Root Directory** como `backend-nfe`

### 2. Configurar variáveis de ambiente
No painel do Railway, vá em **Variables** e adicione todas as variáveis abaixo.

> ⚠️ **ATENÇÃO**: A variável `CERTIFICADO_BASE64` contém o certificado digital.
> Copie o conteúdo do arquivo `certificado.base64.txt` (gerado localmente, NÃO commitado no git).

```
NODE_ENV=producao
CERTIFICADO_BASE64=<conteúdo do arquivo certificado.base64.txt>
CERTIFICADO_SENHA=123456
EMPRESA_CNPJ=07240770000150
EMPRESA_RAZAO_SOCIAL=GRAFICA E EDITORA EXPRESS LTDA
EMPRESA_NOME_FANTASIA=Expressa Gráfica
EMPRESA_IE=00000001341529
EMPRESA_CRT=1
EMPRESA_LOGRADOURO=AVENIDA JO SATO (BR 174)
EMPRESA_NUMERO=3327
EMPRESA_COMPLEMENTO=
EMPRESA_BAIRRO=RESIDENCIAL CIDADE VERDE
EMPRESA_CODIGO_MUNICIPIO=1101708
EMPRESA_MUNICIPIO=VILHENA
EMPRESA_UF=RO
EMPRESA_CEP=76982249
EMPRESA_TELEFONE=69992575495
EMPRESA_EMAIL=contato@expressagrafica.com.br
SISTEMA_NOME=Sistema ERP Gráfica Expressa
SERIE_NFE=1
SEFAZ_UF=RO
SEFAZ_CODIGO_UF=11
SUPABASE_URL=https://vebswpvfgqoikgfpejtu.supabase.co
SUPABASE_KEY=sb_publishable_pWIkSUniojUauvVJu7DcsA_D4DM6t9B
```

> Nota: A variável `PORT` é definida automaticamente pelo Railway. Não precisa configurar.

### 3. Deploy
Após configurar as variáveis, o Railway fará o deploy automaticamente.
Acesse a URL gerada (ex: `https://backend-nfe-production.up.railway.app`) e confirme:
```
GET /health → { "status": "OK", "ambiente": "producao", ... }
```

### 4. Configurar a URL no frontend
Edite o arquivo `frontend/.env` e troque:
```
VITE_NFE_API_URL=http://localhost:3001
```
por:
```
VITE_NFE_API_URL=https://<sua-url>.up.railway.app
```
Faça commit e push para o Netlify redeployar o frontend.

---

## Certificado (como gerar o base64 novamente se precisar)
```bash
# No Windows (Git Bash ou WSL):
base64 -w 0 certificados/certificado.pfx > certificado.base64.txt
```
O arquivo `certificado.base64.txt` está no `.gitignore` e nunca vai para o repositório.
