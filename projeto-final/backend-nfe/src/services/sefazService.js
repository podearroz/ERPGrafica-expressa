import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import { SignedXml } from 'xml-crypto';
import { carregarCertificado } from './certificadoService.js';
import { getSefazUrls } from '../config/sefaz-ro.js';

const CUF     = process.env.SEFAZ_CODIGO_UF || '11';
const VERSAO  = '4.00';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildHttpsAgent(pfxBuffer, pfxSenha) {
  return new https.Agent({
    pfx: pfxBuffer,
    passphrase: pfxSenha,
    rejectUnauthorized: false,  // SEFAZ homologação pode ter cert. auto-assinado
  });
}

// ── Assinatura XMLDSig ─────────────────────────────────────────────────────

export function assinarXml(xmlStr) {
  const { privateKeyPem, certPem } = carregarCertificado();

  // xml-crypto v6: publicCert inclui <X509Certificate> automaticamente
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });

  sig.computeSignature(xmlStr);
  return sig.getSignedXml();
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
  const wsdl = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';
  const idLote = Date.now();
  // nfeSignedXml já é compacto (saída do xml-crypto sem espaços)
  return compact(`<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdl}"><cUF>${CUF}</cUF><versaoDados>${VERSAO}</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdl}"><enviNFe versao="${VERSAO}" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${idLote}</idLote><indSinc>1</indSinc>${nfeSignedXml}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`);
}

function buildSoapConsulta(chave, tpAmb) {
  const wsdl = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4';
  return compact(`<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdl}"><cUF>${CUF}</cUF><versaoDados>${VERSAO}</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdl}"><consSitNFe versao="${VERSAO}" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`);
}

// ── Envio HTTP ─────────────────────────────────────────────────────────────

async function enviarSoap(url, soapBody, soapAction) {
  const { pfxBuffer, pfxSenha } = carregarCertificado();
  const agent = buildHttpsAgent(pfxBuffer, pfxSenha);

  try {
    const response = await axios.post(url, soapBody, {
      httpsAgent: agent,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
      },
      timeout: 30000,
    });
    return response.data;
  } catch (err) {
    // Captura o corpo da resposta de erro da SEFAZ para diagnóstico
    if (err.response) {
      const body = typeof err.response.data === 'string'
        ? err.response.data.substring(0, 2000)
        : JSON.stringify(err.response.data);
      throw new Error(`SEFAZ HTTP ${err.response.status}: ${body}`);
    }
    throw err;
  }
}

async function parseSoapResponse(xml) {
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    ignoreAttrs: false,
    mergeAttrs: true,
  });
  // Percorre o envelope SOAP até o conteúdo da resposta
  const envelope = parsed['soap:Envelope'] || parsed['s:Envelope'] || parsed['Envelope'];
  const body = envelope?.['soap:Body'] || envelope?.['s:Body'] || envelope?.['Body'];
  const msgNode = body?.nfeResultMsg || body?.nfeDadosMsgResult;
  return msgNode || body;
}

// ── Funções exportadas ─────────────────────────────────────────────────────

export async function checkStatusSefaz() {
  const urls  = getSefazUrls();
  const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';

  const soap   = buildSoapStatus(tpAmb);
  const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF';

  const rawXml = await enviarSoap(urls.statusServico, soap, action);
  const parsed = await parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });

  // Navega até retConsStatServ
  const envelope  = Object.values(parsed)[0];
  const bodyNode  = envelope['soap:Body'] || envelope['s:Body'];
  const resultNode = bodyNode?.nfeResultMsg || bodyNode?.nfeDadosMsgResult;
  const statServ  = resultNode?.retConsStatServ || resultNode;

  return {
    rawXml,
    cStat:   statServ?.cStat || statServ?.['retConsStatServ']?.cStat || '?',
    xMotivo: statServ?.xMotivo || statServ?.['retConsStatServ']?.xMotivo || 'Sem retorno',
    dhRecbto:statServ?.dhRecbto,
    tpAmb:   tpAmb === '1' ? 'Produção' : 'Homologação',
  };
}

export async function autorizarNFe(nfeSignedXmlRaw) {
  // Remove a declaração XML (<?xml ...?>) antes de embuti-la no SOAP
  const nfeSignedXml = nfeSignedXmlRaw.replace(/<\?xml[^?]*\?>\s*/i, '');
  const urls  = getSefazUrls();
  const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';
  const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote';

  const soap   = buildSoapAutorizacao(nfeSignedXml, tpAmb);
  const rawXml = await enviarSoap(urls.autorizacao, soap, action);

  const parsed  = await parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });
  const envelope = Object.values(parsed)[0];
  const bodyNode = envelope['soap:Body'] || envelope['s:Body'];
  const result   = bodyNode?.nfeResultMsg || bodyNode?.nfeDadosMsgResult;

  // Resposta síncrona (indSinc=1): retEnviNFe → protNFe
  const retEnv   = result?.retEnviNFe;
  const cStat    = retEnv?.cStat;
  const xMotivo  = retEnv?.xMotivo;
  const protNFe  = retEnv?.protNFe;
  const infProt  = protNFe?.infProt;

  return {
    rawXml,
    cStat:     infProt?.cStat || cStat || '?',
    xMotivo:   infProt?.xMotivo || xMotivo || 'Sem retorno',
    protocolo: infProt?.nProt || null,
    chave:     infProt?.chNFe || null,
    dhRecbto:  infProt?.dhRecbto || null,
    autorizado: (infProt?.cStat || cStat) === '100',
  };
}

export async function consultarNFeSefaz(chave) {
  const urls  = getSefazUrls();
  const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';
  const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF';

  const soap   = buildSoapConsulta(chave, tpAmb);
  const rawXml = await enviarSoap(urls.consulta, soap, action);

  const parsed  = await parseStringPromise(rawXml, { explicitArray: false, mergeAttrs: true });
  const envelope = Object.values(parsed)[0];
  const bodyNode = envelope['soap:Body'] || envelope['s:Body'];
  const result   = bodyNode?.nfeResultMsg || bodyNode?.nfeDadosMsgResult;
  const retCons  = result?.retConsSitNFe;

  const infProt  = retCons?.protNFe?.infProt;
  return {
    rawXml,
    cStat:     retCons?.cStat,
    xMotivo:   retCons?.xMotivo,
    protocolo: infProt?.nProt,
    dhRecbto:  infProt?.dhRecbto,
    situacao:  infProt?.xMotivo,
  };
}
