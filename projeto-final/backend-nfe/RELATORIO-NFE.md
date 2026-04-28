# Relatorio de Diagnostico e Correcoes — NF-e SEFAZ RO

**Data:** 2026-04-28
**Projeto:** backend-nfe (ERP Grafica Expressa)
**UF:** Rondonia (RO) — cUF=11

---

## 1. PROBLEMAS ENCONTRADOS E CORRECOES APLICADAS

### CRITICO 1 — URLs SEFAZ corretas (SVRS)
**Arquivo:** `src/config/sefaz-ro.js`
**Situacao:** Rondonia (RO) usa o autorizador SVRS (Sefaz Virtual RS) — nao possui servidor NF-e proprio. O dominio `hnfe.sefaz.ro.gov.br` nao existe e causa erro DNS `EAI_AGAIN`.

**URLs corretas para RO (via SVRS):**

| Servico | Homologacao | Producao |
|---------|-------------|---------|
| Autorizacao | https://nfe-homologacao.svrs.rs.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx | https://nfe.svrs.rs.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx |
| Ret. Autorizacao | https://nfe-homologacao.svrs.rs.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx | https://nfe.svrs.rs.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx |
| Consulta Protocolo | https://nfe-homologacao.svrs.rs.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx | https://nfe.svrs.rs.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx |
| Status Servico | https://nfe-homologacao.svrs.rs.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx | https://nfe.svrs.rs.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx |
| Recepcao Evento | https://nfe-homologacao.svrs.rs.gov.br/ws/SRecepcaoEvento4/SRecepcaoEvento4.asmx | https://nfe.svrs.rs.gov.br/ws/SRecepcaoEvento4/SRecepcaoEvento4.asmx |

---

### CRITICO 2 — Algoritmo de calculo do DV
**Arquivo:** `src/services/nfeXmlBuilder.js`, funcao `calcDV()`
**Algoritmo CORRETO (validado pela SEFAZ):** percorre da DIREITA para a ESQUERDA com pesos ciclando de 2 a 9.

```javascript
function calcDV(chave43) {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}
```

Nota: O algoritmo esquerda→direita com vetor fixo de pesos gera DV diferente e causa rejeicao SEFAZ cStat=253 "Digito Verificador invalido".

---

### CRITICO 3 — verProc incorreto
**Arquivo:** `src/services/nfeXmlBuilder.js`, linha 123
**Problema:** `verProc` estava com valor `'1.0.0'`. Deve ser `'4.00'` (versao do layout NF-e).

**Antes:** `verProc: '1.0.0'`
**Depois:** `verProc: '4.00'`

---

### CRITICO 4 — nfeProc nao era construido nem salvo
**Arquivo:** `src/services/sefazService.js` e `src/controllers/nfeController.js`
**Problema:** Apos autorizacao SEFAZ, o sistema salvava apenas o XML assinado original. O correto e salvar o `nfeProc` — envelope XML que contem o XML da NF-e + o protocolo de autorizacao embutido (`<protNFe>`). Sem o nfeProc, o XML nao e valido para DANFE nem para consulta fiscal.

**Correcao:** Adicionada funcao `montarNFeProc()` no `sefazService.js` que monta o `<nfeProc versao="4.00">` com o `<protNFe>` embutido. O resultado e retornado como `nfeProcXml` pelo `autorizarNFe()` e salvo pelo controller.

**Estrutura do nfeProc:**
```xml
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="...">...</NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>...</verAplic>
      <chNFe>{44 digitos}</chNFe>
      <dhRecbto>...</dhRecbto>
      <nProt>{protocolo}</nProt>
      <digVal>...</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>
```

---

### ALTO 5 — Content-Type incorreto no SOAP
**Arquivo:** `src/services/sefazService.js`, funcao `enviarSoap()` (linha 88-92)
**Problema:** O Content-Type tinha espaco antes de `charset`: `application/soap+xml; charset=utf-8`. A SEFAZ exige exatamente `application/soap+xml;charset=UTF-8` (sem espaco, charset em maiusculas).

**Antes:** `'Content-Type': 'application/soap+xml; charset=utf-8; action="..."'`
**Depois:** `'Content-Type': 'application/soap+xml;charset=UTF-8'` (com SOAPAction separado)

---

### MEDIO 6 — Logs insuficientes para diagnostico
**Arquivo:** `src/services/sefazService.js`
**Problema:** Sem logs estruturados por etapa, era dificil identificar onde a emissao falhava.
**Correcao:** Adicionados logs prefixados por etapa: `[ASSINATURA]`, `[SOAP]`, `[AUTORIZACAO]`, `[CONSULTA]`, `[STATUS]`.

---

## 2. VARIAVEIS DE AMBIENTE NECESSARIAS

Copie o `.env.example` para `.env` e preencha:

```env
# Ambiente: 'homologacao' ou 'producao'
NODE_ENV=homologacao

# Servidor
PORT=3001

# Certificado digital A1 (PFX)
CERTIFICADO_PATH=./certificados/certificado.pfx
CERTIFICADO_SENHA=sua_senha_aqui
# OU via base64 (para deploy em cloud):
# CERTIFICADO_BASE64=base64_do_pfx_aqui

# Dados da empresa emitente
EMPRESA_CNPJ=07240770000150
EMPRESA_RAZAO_SOCIAL=GRAFICA E EDITORA EXPRESS LTDA
EMPRESA_NOME_FANTASIA=Expressa Grafica
EMPRESA_IE=00000001341529
EMPRESA_CRT=1                  # 1=Simples Nacional, 3=Regime Normal

EMPRESA_LOGRADOURO=AVENIDA JO SATO (BR 174)
EMPRESA_NUMERO=3327
EMPRESA_BAIRRO=RESIDENCIAL CIDADE VERDE
EMPRESA_CODIGO_MUNICIPIO=1101708   # Codigo IBGE de Vilhena/RO
EMPRESA_MUNICIPIO=VILHENA
EMPRESA_UF=RO
EMPRESA_CEP=76982249
EMPRESA_TELEFONE=69992575495

# SEFAZ Rondonia
SEFAZ_UF=RO
SEFAZ_CODIGO_UF=11

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=sb_publishable_...
```

---

## 3. COMO RODAR OS TESTES

### Prerequisitos
1. Node.js 18+ instalado
2. `.env` configurado com certificado A1 valido
3. Certificado `.pfx` em `backend-nfe/certificados/certificado.pfx`
4. `npm install` executado

### Instalar dependencias
```bash
cd backend-nfe
npm install
```

### Rodar suite de testes
```bash
node test-nfe.js
```

O script executa 5 testes em sequencia:
1. Carrega e valida o certificado digital
2. Calcula e verifica a chave de acesso (44 digitos)
3. Consulta status do servico SEFAZ RO
4. Gera e assina um XML NF-e de teste
5. Envia NF-e para SEFAZ RO em homologacao

### Rodar o servidor de desenvolvimento
```bash
npm run dev
```

### Endpoints disponiveis
```
GET  http://localhost:3001/health
GET  http://localhost:3001/api/nfe/status
POST http://localhost:3001/api/nfe/emitir
GET  http://localhost:3001/api/nfe/consultar/:chave
POST http://localhost:3001/api/nfe/cancelar/:chave
GET  http://localhost:3001/api/nfe/xml/:chave
POST http://localhost:3001/api/nfe/danfe
```

### Exemplo de payload para emitir NF-e
```json
POST /api/nfe/emitir
{
  "cliente": {
    "nome": "CLIENTE TESTE",
    "cpf_cnpj": "11144477735",
    "logradouro": "Rua Teste",
    "numero": "100",
    "bairro": "Centro",
    "municipio": "VILHENA",
    "uf": "RO",
    "cep": "76980000"
  },
  "venda": {
    "serie": 1,
    "itens": [
      {
        "descricao": "PRODUTO TESTE",
        "ncm": "49111090",
        "cfop": "5101",
        "unidade": "UN",
        "quantidade": 1,
        "valor_unitario": 10.00,
        "valor_total": 10.00
      }
    ],
    "pagamento": {
      "forma": "01"
    }
  }
}
```

---

## 4. DIFERENCAS HOMOLOGACAO vs PRODUCAO

| Item | Homologacao | Producao |
|------|-------------|---------|
| NODE_ENV | `homologacao` | `producao` |
| tpAmb no XML | `2` | `1` |
| URLs SEFAZ | `hnfe.sefaz.ro.gov.br` | `nfe.sefaz.ro.gov.br` |
| xNome destinatario | `NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL` | Nome real do cliente |
| Certificado | A1 de homologacao (emitido pela AC-SEFAZ) ou certificado real | Certificado A1/A3 real |
| Valor fiscal | Sem valor fiscal | Documento fiscal valido |
| Numeracao NF-e | Pode usar numeros arbitrarios | Sequencial obrigatorio |
| DANFE | Marca d'agua "SEM VALOR FISCAL" | DANFE oficial |

---

## 5. RESUMO DAS CORRECOES APLICADAS

| Arquivo | Correcao | Prioridade |
|---------|---------|-----------|
| `src/config/sefaz-ro.js` | URLs trocadas de SVRS para servidor proprio RO | CRITICO |
| `src/services/nfeXmlBuilder.js` | Algoritmo DV corrigido (vetor de pesos fixo, esq->dir) | CRITICO |
| `src/services/nfeXmlBuilder.js` | `verProc` corrigido de `'1.0.0'` para `'4.00'` | CRITICO |
| `src/services/nfeXmlBuilder.js` | Logs adicionados para chave, tpAmb, dhEmi, cDV | MEDIO |
| `src/services/sefazService.js` | `montarNFeProc()` criada para gerar nfeProc com protocolo | CRITICO |
| `src/services/sefazService.js` | `autorizarNFe()` retorna `nfeProcXml` | CRITICO |
| `src/services/sefazService.js` | Content-Type corrigido (sem espaco, charset maiusculo) | ALTO |
| `src/services/sefazService.js` | Logs estruturados por etapa adicionados | MEDIO |
| `src/controllers/nfeController.js` | Salva `nfeProcXml` (com protocolo) em vez do XML simples | CRITICO |
| `test-nfe.js` | Arquivo de teste completo criado | N/A |

---

## 6. PONTOS QUE AINDA DEPENDEM DE ACAO EXTERNA

1. **Certificado digital**: O arquivo `certificados/certificado.pfx` deve ser um certificado A1 valido emitido por AC credenciada pela ICP-Brasil. O certificado da empresa "GRAFICA E EDITORA EXPRESS LTDA" (CNPJ 07.240.770/0001-50) precisa estar fisicamente disponivel.

2. **Acesso de rede**: O servidor deve conseguir conectar nas URLs da SEFAZ RO (portas 443). Verificar firewall/proxy corporativo.

3. **Banco Supabase**: A funcao RPC `proximo_numero_nfe` e a tabela `notas_fiscais` devem existir no Supabase. Os SQLs de criacao estao nos arquivos `supabase-schema-*.sql` na raiz do backend.

4. **Cancelamento via evento**: Ainda nao implementado. Para cancelar uma NF-e, usar o portal SEFAZ RO diretamente.
