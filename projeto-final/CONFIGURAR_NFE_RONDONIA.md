# 🚀 CONFIGURAÇÃO COMPLETA - EMISSÃO DE NF-e NO SEU APP (RONDÔNIA)

## 📋 Guia Passo a Passo - Sistema Pronto para Produção

Você já tem:
✅ Certificado Digital válido
✅ Sistema de Gestão funcionando
✅ Supabase configurado

Agora vamos:
🎯 Configurar emissão de NF-e
🎯 Integrar com SEFAZ-RO
🎯 Deixar tudo funcionando

---

## 1. PREPARAÇÃO DO CERTIFICADO

### **PASSO 1.1: Verificar o Certificado**

Primeiro, vamos verificar qual tipo de certificado você tem:

**Certificado A1 (arquivo .pfx):**
- Arquivo digital instalado no computador
- Extensão: .pfx ou .p12
- Usado com senha

**Certificado A3 (token/cartão):**
- Hardware físico (token USB ou cartão)
- Precisa de leitora
- Mais seguro

### **PASSO 1.2: Exportar Certificado A1 (se necessário)**

Se você tem A3 mas precisa do A1 para o sistema:

**No Windows:**
```
1. Abra: certmgr.msc
2. Vá em: Certificados - Usuário Atual > Pessoal > Certificados
3. Encontre seu certificado e-CNPJ
4. Clique direito > Todas as Tarefas > Exportar
5. Marque "Sim, exportar a chave privada"
6. Formato: Personal Information Exchange (.PFX)
7. Marque "Incluir todos os certificados"
8. Defina uma senha forte
9. Salve como: certificado.pfx
```

**No Mac:**
```
1. Abra: Acesso às Chaves (Keychain Access)
2. Encontre seu certificado
3. Clique direito > Exportar
4. Formato: Personal Information Exchange (.p12)
5. Defina senha
6. Salve
```

---

## 2. ESTRUTURA DO PROJETO

### **PASSO 2.1: Criar Backend de NF-e**

```bash
# Na raiz do seu projeto
mkdir backend-nfe
cd backend-nfe

# Inicializar
npm init -y

# Instalar dependências
npm install express cors dotenv
npm install node-nfe-api xml2js soap axios
npm install pdfkit qrcode
```

### **PASSO 2.2: Estrutura de Pastas**

```bash
backend-nfe/
├── src/
│   ├── config/
│   │   ├── sefaz-ro.js        # URLs SEFAZ Rondônia
│   │   └── certificado.js     # Configuração do certificado
│   ├── controllers/
│   │   └── nfeController.js   # Endpoints da API
│   ├── services/
│   │   ├── nfeService.js      # Lógica principal
│   │   ├── xmlBuilder.js      # Geração XML
│   │   ├── sefazClient.js     # Comunicação SEFAZ
│   │   └── danfeGenerator.js  # Geração DANFE
│   ├── utils/
│   │   ├── validators.js      # Validações
│   │   └── formatters.js      # Formatadores
│   └── server.js              # Servidor Express
├── certificados/
│   └── certificado.pfx        # SEU CERTIFICADO AQUI
├── storage/
│   ├── xml/                   # XMLs autorizados
│   └── pdf/                   # DANFEs gerados
├── .env
├── .gitignore
└── package.json
```

---

## 3. CONFIGURAÇÃO - ARQUIVOS PRINCIPAIS

### **PASSO 3.1: .env**

```env
# Ambiente
NODE_ENV=homologacao
# Mude para 'producao' quando for para produção
PORT=3001

# Certificado Digital
CERTIFICADO_PATH=./certificados/certificado.pfx
CERTIFICADO_SENHA=SUA_SENHA_AQUI
# ⚠️ NUNCA COMMITE ESTE ARQUIVO NO GIT!

# Dados da Sua Empresa (pegue do CNPJ)
EMPRESA_CNPJ=12345678000190
EMPRESA_RAZAO_SOCIAL=SUA EMPRESA LTDA
EMPRESA_NOME_FANTASIA=Sua Empresa
EMPRESA_IE=123456789
EMPRESA_IM=
EMPRESA_CNAE=4751201
EMPRESA_CRT=1
# CRT: 1=Simples Nacional, 2=Simples Nacional - excesso, 3=Regime Normal

# Endereço da Empresa
EMPRESA_LOGRADOURO=Avenida Exemplo
EMPRESA_NUMERO=123
EMPRESA_COMPLEMENTO=Sala 01
EMPRESA_BAIRRO=Centro
EMPRESA_CODIGO_MUNICIPIO=1100205
# Código do município de Porto Velho: 1100205
EMPRESA_MUNICIPIO=Porto Velho
EMPRESA_UF=RO
EMPRESA_CEP=76801000

# Contato
EMPRESA_TELEFONE=6933334444
EMPRESA_EMAIL=contato@suaempresa.com.br

# Série e Numeração
SERIE_NFE=1
# Próximo número será buscado do banco de dados

# SEFAZ Rondônia
SEFAZ_UF=RO
SEFAZ_CODIGO_UF=11

# Supabase (para salvar dados)
SUPABASE_URL=sua_url_supabase
SUPABASE_KEY=sua_key_supabase
```

### **PASSO 3.2: .gitignore**

```
node_modules/
.env
certificados/*.pfx
certificados/*.p12
storage/xml/*
storage/pdf/*
*.log
```

### **PASSO 3.3: src/config/sefaz-ro.js**

```javascript
// URLs dos webservices da SEFAZ Rondônia

export const SEFAZ_RO = {
  // Ambiente de HOMOLOGAÇÃO (testes)
  homologacao: {
    autorizacao: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consulta: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    statusServico: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    inutilizacao: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeInutilizacao4/NFeInutilizacao4.asmx',
  },

  // Ambiente de PRODUÇÃO
  producao: {
    autorizacao: 'https://nfe.sefin.ro.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.sefin.ro.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consulta: 'https://nfe.sefin.ro.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    statusServico: 'https://nfe.sefin.ro.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe.sefin.ro.gov.br/ws/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    inutilizacao: 'https://nfe.sefin.ro.gov.br/ws/NFeInutilizacao4/NFeInutilizacao4.asmx',
  }
};

// Obter URLs do ambiente atual
export function getSefazUrls() {
  const ambiente = process.env.NODE_ENV === 'producao' ? 'producao' : 'homologacao';
  return SEFAZ_RO[ambiente];
}
```

### **PASSO 3.4: src/server.js**

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
import nfeRoutes from './routes/nfeRoutes.js';
app.use('/api/nfe', nfeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    ambiente: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Teste de certificado
app.get('/test-cert', async (req, res) => {
  try {
    const { testarCertificado } = await import('./services/certificadoService.js');
    const resultado = await testarCertificado();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🚀 API NF-e - Rondônia             ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║   Porta: ${PORT}                        ║`);
  console.log(`║   Ambiente: ${process.env.NODE_ENV}    ║`);
  console.log(`║   SEFAZ: RO                            ║`);
  console.log('╚════════════════════════════════════════╝');
});

export default app;
```

### **PASSO 3.5: src/routes/nfeRoutes.js**

```javascript
import express from 'express';
import {
  emitirNFe,
  consultarNFe,
  cancelarNFe,
  inutilizarNumero,
  downloadXML,
  downloadDANFE,
  verificarStatusSefaz
} from '../controllers/nfeController.js';

const router = express.Router();

// Status do serviço SEFAZ
router.get('/status', verificarStatusSefaz);

// Emitir NF-e
router.post('/emitir', emitirNFe);

// Consultar NF-e
router.get('/consultar/:chave', consultarNFe);

// Cancelar NF-e
router.post('/cancelar/:chave', cancelarNFe);

// Inutilizar numeração
router.post('/inutilizar', inutilizarNumero);

// Download XML
router.get('/xml/:chave', downloadXML);

// Download DANFE (PDF)
router.get('/danfe/:chave', downloadDANFE);

export default router;
```

### **PASSO 3.6: src/services/certificadoService.js**

```javascript
import fs from 'fs';
import path from 'path';

export function carregarCertificado() {
  const certPath = process.env.CERTIFICADO_PATH;
  const certSenha = process.env.CERTIFICADO_SENHA;

  if (!certPath) {
    throw new Error('CERTIFICADO_PATH não configurado no .env');
  }

  if (!certSenha) {
    throw new Error('CERTIFICADO_SENHA não configurado no .env');
  }

  const fullPath = path.resolve(certPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Certificado não encontrado em: ${fullPath}`);
  }

  const pfx = fs.readFileSync(fullPath);

  return {
    pfx,
    senha: certSenha,
    path: fullPath
  };
}

export async function testarCertificado() {
  try {
    const cert = carregarCertificado();
    
    // Tentar carregar o certificado para validar
    const forge = await import('node-forge');
    const p12Asn1 = forge.default.asn1.fromDer(cert.pfx.toString('binary'));
    const p12 = forge.default.pkcs12.pkcs12FromAsn1(p12Asn1, cert.senha);

    // Extrair informações
    const certBags = p12.getBags({ bagType: forge.default.pki.oids.certBag });
    const cert509 = certBags[forge.default.pki.oids.certBag][0].cert;

    const validade = cert509.validity;
    const agora = new Date();
    
    return {
      success: true,
      certificado: {
        valido: agora >= validade.notBefore && agora <= validade.notAfter,
        validoDe: validade.notBefore,
        validoAte: validade.notAfter,
        cnpj: extrairCNPJ(cert509.subject),
        emissor: cert509.issuer.getField('CN')?.value,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function extrairCNPJ(subject) {
  // Extrair CNPJ do subject do certificado
  const serialNumber = subject.getField('serialNumber');
  if (serialNumber) {
    return serialNumber.value.replace(/\D/g, '');
  }
  return null;
}
```

### **PASSO 3.7: src/services/xmlBuilder.js** (Simplificado para RO)

```javascript
export class XMLBuilder {
  construir({ numero, venda, cliente, empresa }) {
    const ambiente = process.env.NODE_ENV === 'producao' ? '1' : '2';
    const serie = process.env.SERIE_NFE || '1';
    const cNF = this.gerarCodigoNumerico();
    const dhEmi = new Date().toISOString();
    
    // Gerar chave de acesso
    const chaveAcesso = this.gerarChaveAcesso({
      uf: '11', // Rondônia
      aamm: this.getAAMM(),
      cnpj: empresa.cnpj,
      mod: '55',
      serie: serie.padStart(3, '0'),
      nNF: numero.toString().padStart(9, '0'),
      tpEmis: '1',
      cNF
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${chaveAcesso}">
    <ide>
      <cUF>11</cUF>
      <cNF>${cNF}</cNF>
      <natOp>Venda de mercadoria</natOp>
      <mod>55</mod>
      <serie>${serie}</serie>
      <nNF>${numero}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${empresa.codigoMunicipio}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chaveAcesso.slice(-1)}</cDV>
      <tpAmb>${ambiente}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>

    <emit>
      <CNPJ>${empresa.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>${this.escaparXML(empresa.razaoSocial)}</xNome>
      <xFant>${this.escaparXML(empresa.nomeFantasia)}</xFant>
      <enderEmit>
        <xLgr>${this.escaparXML(empresa.logradouro)}</xLgr>
        <nro>${empresa.numero}</nro>
        ${empresa.complemento ? `<xCpl>${this.escaparXML(empresa.complemento)}</xCpl>` : ''}
        <xBairro>${this.escaparXML(empresa.bairro)}</xBairro>
        <cMun>${empresa.codigoMunicipio}</cMun>
        <xMun>${this.escaparXML(empresa.municipio)}</xMun>
        <UF>${empresa.uf}</UF>
        <CEP>${empresa.cep.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${empresa.telefone ? `<fone>${empresa.telefone.replace(/\D/g, '')}</fone>` : ''}
      </enderEmit>
      <IE>${empresa.ie}</IE>
      <CRT>${empresa.crt || '1'}</CRT>
    </emit>

    <dest>
      ${this.montarDestinatario(cliente)}
    </dest>

    ${this.montarItens(venda)}

    ${this.montarTotal(venda)}

    <transp>
      <modFrete>9</modFrete>
    </transp>

    ${this.montarPagamento(venda)}

    <infAdic>
      <infCpl>Documento emitido por ME ou EPP optante pelo Simples Nacional. Nao gera direito a credito fiscal de IPI.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;

    return xml;
  }

  montarDestinatario(cliente) {
    const doc = cliente.cpfCnpj.replace(/\D/g, '');
    const tag = doc.length === 11 ? 'CPF' : 'CNPJ';

    return `
      <${tag}>${doc}</${tag}>
      <xNome>${this.escaparXML(cliente.nome)}</xNome>
      <enderDest>
        <xLgr>${this.escaparXML(cliente.logradouro || 'Nao informado')}</xLgr>
        <nro>${cliente.numero || 'SN'}</nro>
        <xBairro>${this.escaparXML(cliente.bairro || 'Centro')}</xBairro>
        <cMun>${cliente.codigoMunicipio || '1100205'}</cMun>
        <xMun>${this.escaparXML(cliente.municipio || 'Porto Velho')}</xMun>
        <UF>${cliente.uf || 'RO'}</UF>
        <CEP>${(cliente.cep || '76801000').replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${cliente.telefone ? `<fone>${cliente.telefone.replace(/\D/g, '')}</fone>` : ''}
      </enderDest>
      ${cliente.email ? `<email>${cliente.email}</email>` : ''}
      <indIEDest>9</indIEDest>
    `;
  }

  montarItens(venda) {
    // Aqui você vai melhorar para suportar múltiplos itens
    // Por enquanto, um item simples
    
    return `
    <det nItem="1">
      <prod>
        <cProd>001</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${this.escaparXML(venda.produtos)}</xProd>
        <NCM>00000000</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vUnCom>${venda.valor.toFixed(4)}</vUnCom>
        <vProd>${venda.valor.toFixed(2)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>1.0000</qTrib>
        <vUnTrib>${venda.valor.toFixed(4)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISSN>
            <CST>49</CST>
          </PISSN>
        </PIS>
        <COFINS>
          <COFINSSN>
            <CST>49</CST>
          </COFINSSN>
        </COFINS>
      </imposto>
    </det>
    `;
  }

  montarTotal(venda) {
    return `
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${venda.valor.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${venda.valor.toFixed(2)}</vNF>
      </ICMSTot>
    </total>
    `;
  }

  montarPagamento(venda) {
    return `
    <pag>
      <detPag>
        <tPag>${this.getCodigoPagamento(venda.formaPagamento)}</tPag>
        <vPag>${venda.valor.toFixed(2)}</vPag>
      </detPag>
    </pag>
    `;
  }

  gerarCodigoNumerico() {
    return Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
  }

  getAAMM() {
    const now = new Date();
    const ano = now.getFullYear().toString().slice(-2);
    const mes = (now.getMonth() + 1).toString().padStart(2, '0');
    return ano + mes;
  }

  gerarChaveAcesso({ uf, aamm, cnpj, mod, serie, nNF, tpEmis, cNF }) {
    const chave = `${uf}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    const dv = this.calcularDV(chave);
    return `${chave}${dv}`;
  }

  calcularDV(chave) {
    let soma = 0;
    let multiplicador = 2;

    for (let i = chave.length - 1; i >= 0; i--) {
      soma += parseInt(chave[i]) * multiplicador;
      multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
    }

    const resto = soma % 11;
    return resto === 0 || resto === 1 ? 0 : 11 - resto;
  }

  getCodigoPagamento(forma) {
    const codigos = {
      'Dinheiro': '01',
      'Cheque': '02',
      'Cartão Crédito': '03',
      'Cartão Débito': '04',
      'PIX': '17',
      'Boleto': '15',
      'Transferência': '18',
    };
    return codigos[forma] || '99';
  }

  escaparXML(texto) {
    if (!texto) return '';
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
```

---

## 4. TESTANDO O SISTEMA

### **PASSO 4.1: Colocar o Certificado**

```bash
# Copie seu certificado.pfx para:
backend-nfe/certificados/certificado.pfx
```

### **PASSO 4.2: Configurar .env**

Edite o arquivo `.env` com seus dados reais.

### **PASSO 4.3: Instalar e Testar**

```bash
cd backend-nfe

# Instalar
npm install

# Testar certificado
npm run dev

# Em outro terminal, testar:
curl http://localhost:3001/test-cert
```

**Deve retornar:**
```json
{
  "success": true,
  "certificado": {
    "valido": true,
    "validoDe": "2024-01-15T00:00:00.000Z",
    "validoAte": "2025-01-15T23:59:59.000Z",
    "cnpj": "12345678000190",
    "emissor": "AC Certisign RFB G5"
  }
}
```

---

## 5. CÓDIGO COMPLETO DOS SERVIÇOS

Vou criar um arquivo ZIP com TODOS os códigos prontos para você. Por agora, aqui está o essencial:

### **package.json completo:**

```json
{
  "name": "backend-nfe-ro",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "test": "node src/test.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0",
    "xml2js": "^0.6.2",
    "fast-xml-parser": "^4.3.0",
    "node-forge": "^1.3.1",
    "pdfkit": "^0.13.0",
    "qrcode": "^1.5.3"
  }
}
```

---

## 6. PRÓXIMOS PASSOS

### **✅ Checklist de Configuração:**

- [ ] Certificado .pfx na pasta certificados/
- [ ] .env configurado com seus dados
- [ ] npm install executado
- [ ] Teste do certificado OK
- [ ] Backend rodando (npm run dev)
- [ ] Teste de status SEFAZ OK

### **🎯 Para Produção:**

1. Mudar `NODE_ENV=producao` no .env
2. Testar em homologação primeiro
3. Validar todas as emissões
4. Fazer deploy do backend

---

Quer que eu continue e crie os arquivos restantes (controllers, services completos, integração com frontend)? 🚀
