import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import { SignedXml } from 'xml-crypto';
import { carregarCertificado } from './certificadoService.js';
import { getSefazUrls } from '../config/sefaz-ro.js';

const CUF    = process.env.SEFAZ_CODIGO_UF || '11';
const VERSAO = '4.00';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildHttpsAgent(pfxBuffer, pfxSenha) {
  return new https.Agent({
    pfx:               pfxBuffer,
    passphrase:        pfxSenha,
    rejectUnauthorized: false,  // SEFAZ homologação pode ter cert. auto-assinado
  });
}

// ── Assinatura XMLDSig ─────────────────────────────────────────────────────
// CRITICO: algoritmo RSA-SHA1 (NÃO SHA256) + canonicalização C14N (NÃO exclusiva)
// Referência: Manual de Integração NF-e v6.00, Seção 4.1

export function assinarXml(xmlStr) {
  const { privateKeyPem, certPem } = carregarCertificado();

  console.log('[ASSINATURA] Iniciando assinatura RSA-SHA1 com C14N...');

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    // CRITICO: RSA-SHA1 obrigatório para NF-e (não SHA256)
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    // CRITICO: C14N NÃO exclusiva (sem #WithComments, sem exclusive)
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });

  sig.addReference({
    // URI aponta para o Id="NFe{44digitos}" da tag infNFe
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      // CRITICO: C14N (não exclusiva) na transform também
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    // CRITICO: SHA1 como algoritmo de digest (não SHA256)
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });

  sig.computeSignature(xmlStr);
  const xmlAssinado = sig.getSignedXml();
  console.log('[ASSINATURA] XML assinado com sucesso.');
  return xmlAssinado;
}

// ── SOAP builders ──────────────────────────────────────────────────────────

// SEFAZ exige XML compacto — sem espaços nem quebras de linha entre tags
function compact(xml) {
  return xml.replace(/>\s+</g, '><').trim();
}

function buildSoapStatus(tpAmb) {
  const wsdl = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';
  return compact(`<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Header>
<nfeCabecMsg xmlns="${wsdl}"><cUF>${CUF}</cUF><versaoDados>${VERSAO}</versaoDados></nfeCabecMsg>
</soap12:Header>
<soap12:Body>
<nfeDadosMsg xmlns="${wsdl}">
<consStatServ versao="${VERSAO}" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><cUF>${CUF}</cUF><xServ>STATUS</xServ></consStatServ>
</nfeDadosMsg>
</soap12:Body>
</soap12:Envelope>`);
}

function buildSoapAutorizacao(nfeSignedXml, tpAmb) {
  const wsdl   = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';
  const idLote = Date.now();
  // nfeSignedXml já é compacto (saída do xml-crypto sem espaços)
  return compact(`<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdl}"><cUF>${CUF}</cUF><versaoDados>${VERSAO}</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdl}"><enviNFe versao="${VERSAO}" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${idLote}</idLote><indSinc>1</indSinc>${nfeSignedXml}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`);
}

function buildSoapConsulta(chave, tpAmb) {
  const wsdl = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4';
  return compact(`<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdl}"><cUF>${CUF}</cUF><versaoDados>${VERSAO}</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdl}"><consSitNFe versao="${VERSAO}" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`);
}

// ── Monta o nfeProc — XML autorizado com protocolo embutido ────────────────
// Obrigatório salvar nfeProc (não apenas o XML assinado) após autorização SEFAZ
// Referência: Manual de Integração NF-e v6.00, Seção 6.4

function montarNFeProc(nfeAssinadoXml, infProt) {
  // Remove declaração XML do nfe assinado para embutir no nfeProc
  const nfeCorpo = nfeAssinadoXml.replace(/<\?xml[^?]*\?>\s*/i, '').trim();

  const tpAmb      = infProt?.tpAmb    || (process.env.NODE_ENV === 'producao' ? '1' : '2');
  const verAplic   = infProt?.verAplic || '';
  const chNFe      = infProt?.chNFe    || '';
  const dhRecbto   = infProt?.dhRecbto || new Date().toISOString();
  const nProt      = infProt?.nProt    || '';
  const digVal     = infProt?.digVal   || '';
  const cStat      = infProt?.cStat    || '100';
  const xMotivo    = infProt?.xMotivo  || 'Autorizado o uso da NF-e';

  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${nfeCorpo}<protNFe versao="4.00"><infProt><tpAmb>${tpAmb}</tpAmb><verAplic>${verAplic}</verAplic><chNFe>${chNFe}</chNFe><dhRecbto>${dhRecbto}</dhRecbto><nProt>${nProt}</nProt><digVal>${digVal}</digVal><cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo></infProt></protNFe></nfeProc>`;
}

// ── Envio HTTP ─────────────────────────────────────────────────────────────

async function enviarSoap(url, soapBody, soapAction) {
  const { pfxBuffer, pfxSenha } = carregarCertificado();
  const agent = buildHttpsAgent(pfxBuffer, pfxSenha);

  console.log(`[SOAP] POST ${url}`);
  console.log(`[SOAP] Action: ${soapAction}`);

  try {
    const response = await axios.post(url, soapBody, {
      httpsAgent: agent,
      headers: {
        // CRITICO: sem espaço antes de charset — formato exato exigido pela SEFAZ
        'Content-Type': `application/soap+xml;charset=UTF-8`,
        'SOAPAction':   soapAction,
      },
      timeout: 30000,
    });
    console.log(`[SOAP] Resposta HTTP ${response.status} recebida.`);
    return response.data;
  } catch (err) {
    // Captura o corpo da resposta de erro da SEFAZ para diagnóstico
    if (err.response) {
      const body = typeof err.response.data === 'string'
        ? err.response.data.substring(0, 2000)
        : JSON.stringify(err.response.data);
      console.error(`[SOAP] Erro HTTP ${err.response.status}: ${body}`);
      throw new Error(`SEFAZ HTTP ${err.response.status}: ${body}`);
    }
    console.error(`[SOAP] Erro de conexão: ${err.message}`);
    throw err;
  }
}

async function parseSoapResponse(xml) {
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    ignoreAttrs:   false,
    mergeAttrs:    true,
  });
  // Percorre o envelope SOAP até o conteúdo da resposta
  const envelope = parsed['soap:Envelope'] || parsed['s:Envelope'] || parsed['Envelope'];
  const body     = envelope?.['soap:Body'] || envelope?.['s:Body'] || envelope?.['Body'];
  const msgNode  = body?.nfeResultMsg || body?.nfeDadosMsgResult;
  return msgNode || body;
}

// ── Funções exportadas ─────────────────────────────────────────────────────

export async function checkStatusSefaz() {
  const urls  = getSefazUrls();
  const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';

  console.log(`[STATUS] Verificando SEFAZ RO em ${urls.statusServico}...`);
  const soap   = buildSoapStatus(tpAmb);
  const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF';

  const rawXml = await enviarSoap(urls.statusServico, soap, action);
  const parsed = await parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });

  // Navega até retConsStatServ
  const envelope   = Object.values(parsed)[0];
  const bodyNode   = envelope['soap:Body'] || envelope['s:Body'];
  const resultNode = bodyNode?.nfeResultMsg || bodyNode?.nfeDadosMsgResult;
  const statServ   = resultNode?.retConsStatServ || resultNode;

  const cStat   = statServ?.cStat   || statServ?.['retConsStatServ']?.cStat   || '?';
  const xMotivo = statServ?.xMotivo || statServ?.['retConsStatServ']?.xMotivo || 'Sem retorno';
  console.log(`[STATUS] cStat=${cStat} | ${xMotivo}`);

  return {
    rawXml,
    cStat,
    xMotivo,
    dhRecbto: statServ?.dhRecbto,
    tpAmb:    tpAmb === '1' ? 'Producao' : 'Homologacao',
  };
}

export async function autorizarNFe(nfeSignedXmlRaw) {
  // Remove a declaração XML (<?xml ...?>) antes de embuti-la no SOAP
  const nfeSignedXml = nfeSignedXmlRaw.replace(/<\?xml[^?]*\?>\s*/i, '');
  const urls   = getSefazUrls();
  const tpAmb  = process.env.NODE_ENV === 'producao' ? '1' : '2';
  const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote';

  console.log(`[AUTORIZACAO] Enviando NF-e para SEFAZ RO em ${urls.autorizacao}...`);
  const soap   = buildSoapAutorizacao(nfeSignedXml, tpAmb);
  const rawXml = await enviarSoap(urls.autorizacao, soap, action);

  const parsed   = await parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });
  const envelope = Object.values(parsed)[0];
  const bodyNode = envelope['soap:Body'] || envelope['s:Body'];
  const result   = bodyNode?.nfeResultMsg || bodyNode?.nfeDadosMsgResult;

  // Resposta síncrona (indSinc=1): retEnviNFe → protNFe
  const retEnv  = result?.retEnviNFe;
  const cStat   = retEnv?.cStat;
  const xMotivo = retEnv?.xMotivo;
  const protNFe = retEnv?.protNFe;
  const infProt = protNFe?.infProt;

  const cStatFinal   = infProt?.cStat   || cStat   || '?';
  const xMotivoFinal = infProt?.xMotivo || xMotivo || 'Sem retorno';
  console.log(`[AUTORIZACAO] cStat=${cStatFinal} | ${xMotivoFinal}`);
  console.log(`[AUTORIZACAO] nProt=${infProt?.nProt || 'N/A'} | chNFe=${infProt?.chNFe || 'N/A'}`);

  // Monta nfeProc (XML com protocolo embutido) para salvar no banco
  let nfeProcXml = null;
  if (infProt && cStatFinal === '100') {
    nfeProcXml = montarNFeProc(nfeSignedXmlRaw, infProt);
    console.log('[AUTORIZACAO] nfeProc montado com sucesso.');
  }

  return {
    rawXml,
    nfeProcXml,   // XML completo com protocolo embutido (salvar no banco)
    cStat:     cStatFinal,
    xMotivo:   xMotivoFinal,
    protocolo: infProt?.nProt    || null,
    chave:     infProt?.chNFe    || null,
    dhRecbto:  infProt?.dhRecbto || null,
    autorizado: cStatFinal === '100',
  };
}

export async function consultarNFeSefaz(chave) {
  const urls  = getSefazUrls();
  const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';
  const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF';

  console.log(`[CONSULTA] Consultando chave ${chave} na SEFAZ RO...`);
  const soap   = buildSoapConsulta(chave, tpAmb);
  const rawXml = await enviarSoap(urls.consulta, soap, action);

  const parsed   = await parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });
  const envelope = Object.values(parsed)[0];
  const bodyNode = envelope['soap:Body'] || envelope['s:Body'];
  const result   = bodyNode?.nfeResultMsg || bodyNode?.nfeDadosMsgResult;
  const retCons  = result?.retConsSitNFe;

  const infProt = retCons?.protNFe?.infProt;
  console.log(`[CONSULTA] cStat=${retCons?.cStat} | ${retCons?.xMotivo}`);

  return {
    rawXml,
    cStat:     retCons?.cStat,
    xMotivo:   retCons?.xMotivo,
    protocolo: infProt?.nProt,
    dhRecbto:  infProt?.dhRecbto,
    situacao:  infProt?.xMotivo,
  };
}

// ── Cancelamento de NF-e (evento 110111) ─────────────────────────────────

function buildEventoCancelamento(chave, protocolo, justificativa, tpAmb, cnpj) {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3 (Brasília)
  const dhEvento = brt.toISOString().replace(/\.\d{3}Z$/, '-03:00');
  const idEvento = `ID110111${chave}01`;
  return compact(`<?xml version="1.0" encoding="UTF-8"?><envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${Date.now()}</idLote><evento versao="1.00"><infEvento Id="${idEvento}"><cOrgao>${CUF}</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocolo}</nProt><xJust>${justificativa}</xJust></detEvento></infEvento></evento></envEvento>`);
}

function buildSoapEvento(eventoAssinado) {
  const wsdl = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
  const corpo = eventoAssinado.replace(/<\?xml[^?]*\?>\s*/i, '');
  return compact(`<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdl}"><cUF>${CUF}</cUF><versaoDados>1.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdl}">${corpo}</nfeDadosMsg></soap12:Body></soap12:Envelope>`);
}

export function assinarEvento(xmlStr) {
  const { privateKeyPem, certPem } = carregarCertificado();
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: "//*[local-name(.)='infEvento']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  sig.computeSignature(xmlStr, {
    location: {
      reference: "//*[local-name(.)='infEvento']",
      action: 'after',
    },
  });
  console.log('[ASSINATURA EVENTO] Evento assinado com sucesso.');
  return sig.getSignedXml();
}

export async function cancelarNFeSefaz(chave, protocolo, justificativa) {
  const urls   = getSefazUrls();
  const tpAmb  = process.env.NODE_ENV === 'producao' ? '1' : '2';
  const cnpj   = (process.env.EMPRESA_CNPJ || '').replace(/\D/g, '');
  const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';

  console.log(`[CANCELAMENTO] Gerando evento para NF-e ${chave}...`);
  const eventoXml    = buildEventoCancelamento(chave, protocolo, justificativa, tpAmb, cnpj);
  const eventoAsssin = assinarEvento(eventoXml);
  const soap         = buildSoapEvento(eventoAsssin);

  console.log(`[CANCELAMENTO] Enviando para SEFAZ RO em ${urls.recepcaoEvento}...`);
  const rawXml = await enviarSoap(urls.recepcaoEvento, soap, action);

  const parsed   = await parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });
  const envelope = Object.values(parsed)[0];
  const bodyNode = envelope['soap:Body'] || envelope['s:Body'];
  const result   = bodyNode?.nfeResultMsg || bodyNode?.nfeDadosMsgResult;

  const retEnv    = result?.retEnvEvento;
  const retEvt    = retEnv?.retEvento;
  const infRetEvt = retEvt?.infEvento;

  const cStat   = infRetEvt?.cStat   || retEnv?.cStat   || '?';
  const xMotivo = infRetEvt?.xMotivo || retEnv?.xMotivo || 'Sem retorno';
  const nProt   = infRetEvt?.nProt;

  console.log(`[CANCELAMENTO] cStat=${cStat} | ${xMotivo}`);

  // 135 = Evento registrado e vinculado a NF-e cancelada
  // 101 = Cancelamento de NF-e homologado (alguns ambientes)
  const cancelado = ['135', '101', '155'].includes(String(cStat));

  return { rawXml, cStat, xMotivo, protocolo: nProt, cancelado };
}
