import puppeteer from 'puppeteer';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parseStringPromise } from 'xml2js';
import { gerarHtmlDanfe } from '../services/danfeTemplate.js';
const require = createRequire(import.meta.url);
const bwipjs = require('bwip-js');
import { buildNFeXml } from '../services/nfeXmlBuilder.js';
import { assinarXml, autorizarNFe, consultarNFeSefaz, checkStatusSefaz, cancelarNFeSefaz } from '../services/sefazService.js';
import { getInfoCertificado } from '../services/certificadoService.js';
import { proximoNumeroNFe, rollbackNumeroNFe, salvarNFe, buscarNFePorChave, consultarSequencia, atualizarStatusNFe } from '../services/supabaseNfeService.js';

// ── Parser do nfeProc XML — extrai todos os dados para o DANFE ───────────────
function _t(v) { return typeof v === 'object' && v !== null ? (v._ ?? '') : (v ?? ''); }

function _extractCST(imposto) {
  if (!imposto?.ICMS) return '';
  const icms = imposto.ICMS;
  for (const key of Object.keys(icms)) {
    const g = icms[key];
    if (g?.CSOSN) return `0${_t(g.CSOSN)}`;
    if (g?.CST)   return _t(g.CST);
  }
  return '';
}

async function parsearNFeXml(xmlStr) {
  const parsed = await parseStringPromise(xmlStr, { explicitArray: false, ignoreAttrs: true });
  const proc  = parsed.nfeProc;
  const nfe   = proc.NFe.infNFe;
  const prot  = proc.protNFe?.infProt;
  const ide   = nfe.ide;
  const emit  = nfe.emit;
  const dest  = nfe.dest;
  const transp = nfe.transp;
  const tot   = nfe.total?.ICMSTot;
  const infAdic = nfe.infAdic;

  const detRaw = nfe.det;
  const dets = Array.isArray(detRaw) ? detRaw : (detRaw ? [detRaw] : []);

  const pagDet = nfe.pag?.detPag;
  const tPag = Array.isArray(pagDet) ? pagDet[0]?.tPag : pagDet?.tPag;

  const dhEmi    = _t(ide.dhEmi);
  const dhSaiEnt = _t(ide.dhSaiEnt) || dhEmi;
  const horaSaida = dhSaiEnt.includes('T') ? dhSaiEnt.split('T')[1].substring(0, 8) : '';

  return {
    numero:            parseInt(_t(ide.nNF)),
    serie:             _t(ide.serie),
    chave_acesso:      _t(prot?.chNFe) || '',
    protocolo:         _t(prot?.nProt) || '',
    protocolo_data:    _t(prot?.dhRecbto) || '',
    data:              dhEmi.split('T')[0],
    data_saida:        dhSaiEnt.split('T')[0],
    hora_saida:        horaSaida,
    natureza_operacao: _t(ide.natOp),

    destinatario_json: {
      nome:               _t(dest?.xNome),
      cpf_cnpj:           _t(dest?.CNPJ || dest?.CPF),
      inscricao_estadual: _t(dest?.IE),
      logradouro:         _t(dest?.enderDest?.xLgr),
      numero:             _t(dest?.enderDest?.nro),
      complemento:        _t(dest?.enderDest?.xCpl),
      bairro:             _t(dest?.enderDest?.xBairro),
      municipio:          _t(dest?.enderDest?.xMun),
      uf:                 _t(dest?.enderDest?.UF),
      cep:                _t(dest?.enderDest?.CEP),
      telefone:           _t(dest?.enderDest?.fone),
      email:              _t(dest?.email),
    },

    itens: dets.map(det => ({
      codigo:         _t(det.prod.cProd),
      descricao:      _t(det.prod.xProd),
      ncm:            _t(det.prod.NCM),
      cfop:           _t(det.prod.CFOP),
      unidade:        _t(det.prod.uCom),
      quantidade:     parseFloat(_t(det.prod.qCom) || 0),
      valor_unitario: parseFloat(_t(det.prod.vUnCom) || 0),
      valor_total:    parseFloat(_t(det.prod.vProd) || 0),
      cst:            _extractCST(det.imposto),
      origem:         '0',
    })),

    totais: {
      bc_icms:       parseFloat(_t(tot?.vBC)    || 0),
      valor_icms:    parseFloat(_t(tot?.vICMS)  || 0),
      bc_icms_st:    parseFloat(_t(tot?.vBCST)  || 0),
      valor_icms_st: parseFloat(_t(tot?.vST)    || 0),
      valor_ipi:     parseFloat(_t(tot?.vIPI)   || 0),
    },
    valor_frete:     parseFloat(_t(tot?.vFrete) || 0),
    valor_seguro:    parseFloat(_t(tot?.vSeg)   || 0),
    desconto:        parseFloat(_t(tot?.vDesc)  || 0),
    outras_despesas: parseFloat(_t(tot?.vOutro) || 0),

    modalidade_frete: _t(transp?.modFrete) || '9',
    forma_pagamento:  _t(tPag) || '01',
    observacoes:      _t(infAdic?.infCpl) || '',
  };
}

// Caminho do logo da empresa (em backend-nfe/assets/)
const __dirname_ctrl = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname_ctrl, '..', '..', 'assets', 'Logo_2026.png');

// ── Status do serviço SEFAZ ───────────────────────────────────────────────

export async function statusSefaz(req, res) {
  try {
    console.log('🔎 Verificando status da SEFAZ RO...');
    const [certInfo, status, sequencia] = await Promise.all([
      Promise.resolve(getInfoCertificado()),
      checkStatusSefaz(),
      consultarSequencia('1'),
    ]);

    res.json({
      success: true,
      sefaz: {
        cStat:   status.cStat,
        xMotivo: status.xMotivo,
        dhRecbto:status.dhRecbto,
        online:  status.cStat === '107',
        ambiente:status.tpAmb,
      },
      certificado: certInfo,
      sequencia,
    });
  } catch (error) {
    console.error('Erro ao verificar status SEFAZ:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Emissão de NF-e ───────────────────────────────────────────────────────

export async function emitirNFe(req, res) {
  try {
    const body = req.body;

    // Suporta payload estruturado { venda, cliente } e o formato legado { destinatario, itens }
    const nota_id          = body.nota_id                 ?? null;
    const serie            = body.venda?.serie            ?? body.serie            ?? 1;
    const destinatario     = body.cliente                 ?? body.destinatario;
    const itens            = body.venda?.itens            ?? body.itens;
    const formaPagamento   = body.venda?.pagamento?.forma ?? body.formaPagamento   ?? '01';
    const naturezaOperacao = body.venda?.natureza_operacao ?? body.naturezaOperacao;

    if (!destinatario || !itens?.length) {
      return res.status(400).json({
        success: false,
        error: 'Envie: cliente { nome, cpf_cnpj } e venda.itens [{ descricao, quantidade, valor_unitario, valor_total }]',
      });
    }

    // ── Valida CPF/CNPJ do destinatário ANTES de consumir número ───────────
    const docDestValidacao = String(destinatario.cpf_cnpj || '').replace(/\D/g, '');
    if (docDestValidacao && docDestValidacao.length !== 11 && docDestValidacao.length !== 14) {
      return res.status(400).json({
        success: false,
        error: `CPF/CNPJ do destinatário inválido: "${destinatario.cpf_cnpj}" possui ${docDestValidacao.length} dígitos. CPF deve ter 11 e CNPJ 14 dígitos.`,
      });
    }

    // ── 1. Pega próximo número do banco (atômico) ──────────────────────────
    console.log('🔢 Obtendo próximo número NF-e do banco...');
    const numero = await proximoNumeroNFe(String(serie));
    console.log(`   Número reservado: ${numero}`);

    // ── 2. Gera e assina o XML ─────────────────────────────────────────────
    console.log(`📝 Gerando XML NF-e nº ${numero}...`);
    const { xmlStr, chave } = buildNFeXml({ numero, serie, destinatario, itens, formaPagamento, naturezaOperacao });

    console.log('🔏 Assinando XML com certificado digital...');
    const xmlAssinado = assinarXml(xmlStr);

    // ── 3. Envia para SEFAZ ────────────────────────────────────────────────
    console.log('📡 Enviando para SEFAZ RO...');
    const resultado = await autorizarNFe(xmlAssinado);
    console.log(`↩️  SEFAZ retornou cStat=${resultado.cStat}: ${resultado.xMotivo}`);

    if (!resultado.autorizado) {
      // cStat 204 = NF-e duplicada: SEFAZ já registrou o número, não reverter
      const numeroDuplicado = resultado.cStat === 204;
      if (!numeroDuplicado) {
        await rollbackNumeroNFe(String(serie));
      }
      return res.status(422).json({
        success:          false,
        cStat:            resultado.cStat,
        xMotivo:          resultado.xMotivo,
        numero,
        numeroDevolvido:  !numeroDuplicado,
        error:            `SEFAZ rejeitou a NF-e (${resultado.cStat}): ${resultado.xMotivo}`,
      });
    }

    // ── 4. Salva no Supabase após autorização ─────────────────────────────
    // Salva o nfeProc (XML com protocolo embutido), não apenas o XML assinado
    const xmlParaSalvar = resultado.nfeProcXml || xmlAssinado;
    const valor = itens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
    const notaSalva = await salvarNFe({
      notaId:          nota_id,
      numeroNfe:       numero,
      serie,
      chaveAcesso:     resultado.chave || chave,
      protocolo:       resultado.protocolo,
      dataAutorizacao: resultado.dhRecbto,
      valor,
      clienteNome:     destinatario.nome,
      clienteDoc:      String(destinatario.cpf_cnpj || '').replace(/\D/g, ''),
      destinatario,
      itens,
      formaPagamento:  formaPagamento ?? '01',
      xmlConteudo:     xmlParaSalvar,
    });

    console.log(`💾 NF-e salva no banco. ID: ${notaSalva.id}`);

    res.json({
      success: true,
      data: {
        id:             notaSalva.id,
        chaveAcesso:    resultado.chave || chave,
        numero,
        serie,
        protocolo:      resultado.protocolo,
        dataAutorizacao:resultado.dhRecbto,
        valor,
      },
      message: `✅ NF-e nº ${numero} autorizada e salva! Protocolo: ${resultado.protocolo}`,
    });
  } catch (error) {
    console.error('Erro ao emitir NF-e:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Consulta de NF-e ──────────────────────────────────────────────────────

export async function consultarNFe(req, res) {
  try {
    const { chave } = req.params;
    if (!chave || chave.length !== 44) {
      return res.status(400).json({ success: false, error: 'Chave deve ter 44 dígitos' });
    }

    // Busca no banco local primeiro
    const notaLocal = await buscarNFePorChave(chave);

    // Consulta situação atual na SEFAZ
    console.log('🔍 Consultando NF-e na SEFAZ:', chave);
    const resultado = await consultarNFeSefaz(chave);

    res.json({
      success:   true,
      cStat:     resultado.cStat,
      xMotivo:   resultado.xMotivo,
      protocolo: resultado.protocolo,
      dhRecbto:  resultado.dhRecbto,
      situacao:  resultado.situacao,
      chave,
      local: notaLocal ? {
        id:        notaLocal.id,
        numero:    notaLocal.numero_nfe,
        serie:     notaLocal.serie,
        valor:     notaLocal.valor,
        cliente:   notaLocal.cliente,
        status:    notaLocal.status,
        ambiente:  notaLocal.ambiente,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Cancelamento (evento) ─────────────────────────────────────────────────

export async function cancelarNFe(req, res) {
  try {
    const { chave }                    = req.params;
    const { justificativa, protocolo } = req.body;

    if (!chave || chave.length !== 44) {
      return res.status(400).json({ success: false, error: 'Chave deve ter 44 dígitos' });
    }
    if (!justificativa || justificativa.trim().length < 15) {
      return res.status(400).json({ success: false, error: 'Justificativa deve ter pelo menos 15 caracteres' });
    }
    if (!protocolo) {
      return res.status(400).json({ success: false, error: 'Protocolo de autorização obrigatório para cancelamento' });
    }

    console.log('❌ Cancelamento solicitado para NF-e:', chave);
    const resultado = await cancelarNFeSefaz(chave, protocolo, justificativa.trim());

    if (resultado.cancelado) {
      await atualizarStatusNFe(chave, 'Cancelada');
    }

    res.json({
      success:                resultado.cancelado,
      cancelado:              resultado.cancelado,
      cStat:                  resultado.cStat,
      xMotivo:                resultado.xMotivo,
      protocolo_cancelamento: resultado.protocolo,
      message: resultado.cancelado
        ? `NF-e cancelada com sucesso! ${resultado.xMotivo}`
        : `SEFAZ rejeitou o cancelamento (${resultado.cStat}): ${resultado.xMotivo}`,
    });
  } catch (error) {
    console.error('Erro ao cancelar NF-e:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Download XML ──────────────────────────────────────────────────────────

export async function downloadXML(req, res) {
  try {
    const { chave } = req.params;
    // Em produção: buscar o XML autorizado do banco de dados
    res.status(501).json({ success: false, error: 'Implemente busca do XML assinado no banco de dados.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Puppeteer: gera PDF a partir de HTML ─────────────────────────────────────
async function gerarPdfPuppeteer(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }
}

// ── Prepara dados comuns do DANFE ─────────────────────────────────────────────
async function _prepararDadosDanfe(nota) {
  // Se tiver chave de acesso, busca o XML oficial do banco e sobrescreve os dados
  const chaveStr = (nota.chave_acesso || '').replace(/\D/g, '');
  if (chaveStr.length === 44) {
    try {
      const registro = await buscarNFePorChave(chaveStr);
      if (registro?.xml_conteudo) {
        const xmlData = await parsearNFeXml(registro.xml_conteudo);
        nota = { ...nota, ...xmlData };
        console.log(`📄 DANFE gerado a partir do XML oficial (NF ${xmlData.numero})`);
      }
    } catch (xmlErr) {
      console.warn('⚠️ Falha ao parsear XML, usando dados do frontend:', xmlErr.message);
    }
  }

  // Normaliza campos financeiros
  if (nota.valor_frete     == null) nota.valor_frete     = parseFloat(nota.totais?.valor_frete    || 0);
  if (nota.valor_seguro    == null) nota.valor_seguro    = parseFloat(nota.totais?.valor_seguro   || 0);
  if (nota.desconto        == null) nota.desconto        = parseFloat(nota.totais?.desconto       || 0);
  if (nota.outras_despesas == null) nota.outras_despesas = parseFloat(nota.totais?.valor_despesas || nota.totais?.outras_despesas || 0);

  // Normaliza itens
  if (nota.itens?.length) {
    nota.itens = nota.itens.map(it => ({
      ...it,
      origem: it.origem ?? '0',
      cst: it.cst ? (String(it.cst).length < 4 ? `0${it.cst}` : String(it.cst)) : '0102',
    }));
  }

  // Dados emitente (via variáveis de ambiente)
  const emit = {
    razao:      process.env.EMPRESA_RAZAO_SOCIAL || '',
    fantasia:   process.env.EMPRESA_NOME_FANTASIA || '',
    cnpj:       (process.env.EMPRESA_CNPJ || '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
    ie:         process.env.EMPRESA_IE || '',
    im:         process.env.EMPRESA_IM || '',
    crt:        process.env.EMPRESA_CRT || '1',
    logradouro: process.env.EMPRESA_LOGRADOURO || '',
    numero:     process.env.EMPRESA_NUMERO || '',
    bairro:     process.env.EMPRESA_BAIRRO || '',
    municipio:  process.env.EMPRESA_MUNICIPIO || '',
    uf:         process.env.EMPRESA_UF || '',
    cep:        (process.env.EMPRESA_CEP || '').replace(/(\d{5})(\d{3})/, '$1-$2'),
    telefone:   (process.env.EMPRESA_TELEFONE || '').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3'),
  };

  const itens = nota.itens?.length > 0 ? nota.itens : [{
    codigo: '', descricao: nota.descricao || 'Serviços/Produtos',
    ncm: '49111090', cfop: '5101', cst: '0102', unidade: 'UN', origem: '0',
    quantidade: 1, valor_unitario: nota.valor, valor_total: nota.valor,
  }];

  // Destinatário
  let dest = nota.destinatario_json || nota.venda?.cliente || {};
  if (typeof dest === 'string') { try { dest = JSON.parse(dest); } catch (_) { dest = {}; } }
  if (!dest.nome)    dest.nome    = nota.destinatario_nome || nota.cliente || '';
  if (!dest.cpf_cnpj) dest.cpf_cnpj = nota.destinatario_doc || '';

  const chave          = (nota.chave_acesso || '').replace(/\D/g, '').padEnd(44, '0');
  const chaveFormatada = chave.match(/.{1,4}/g)?.join(' ') || chave;
  const serie          = String(nota.serie || '1').padStart(3, '0');
  const numInt         = parseInt(nota.numero || '0');
  const numeroFmt      = numInt > 0
    ? String(numInt).padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
    : '000.000.000';

  const dataEmissao = nota.data ? new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const dataSaida   = nota.data_saida
    ? new Date(nota.data_saida + 'T00:00:00').toLocaleDateString('pt-BR')
    : dataEmissao;
  const horaSaida   = nota.hora_saida || '';
  const natOp       = nota.natureza_operacao || 'Venda de produção do estabelecimento';
  const tpAmb       = process.env.NODE_ENV === 'producao' ? '1' : '2';

  const formatProtoDatetime = (dt) => {
    if (!dt) return '';
    try {
      const d = new Date(dt);
      return d.toLocaleString('pt-BR', {
        timeZone: 'America/Porto_Velho',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).replace(',', '');
    } catch (_) { return ''; }
  };

  const protocoloDisplay = nota.protocolo
    ? `${nota.protocolo} - ${formatProtoDatetime(nota.protocolo_data) || dataEmissao}`
    : (tpAmb === '2' ? 'AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL' : '—');

  const rawObs = nota.observacoes
    || `EMPRESA OPTANTE PELO SIMPLES NACIONAL; DADOS BANCARIOS:; SICOOB; AG: 3325 C/C 4.231-5; GRAFICA E EDITORA EXPRESS LTDA ME; OU PIX:; CNPJ ${emit.cnpj}`;
  const obsCompl = rawObs.split(';').map(s => s.trim()).filter(Boolean).join('\n');

  const FRETE_LABELS = {
    '0': '(0) Por conta do Emitente',
    '1': '(1) Por conta do Destinatário',
    '2': '(2) Por conta de Terceiros',
    '9': '(9) Sem Frete',
  };
  const freteLabel = FRETE_LABELS[String(nota.modalidade_frete || '9')] || '(9) Sem Frete';

  const totalProdutos = itens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
  const totalNota     = totalProdutos
    + parseFloat(nota.valor_frete    || 0)
    + parseFloat(nota.valor_seguro   || 0)
    + parseFloat(nota.outras_despesas || 0)
    - parseFloat(nota.desconto       || 0);

  // Barcode Code 128 como base64 PNG
  const chaveReal = chave && chave.replace(/0/g, '').length > 0;
  let barcode64 = null;
  if (chaveReal) {
    try {
      const buf = await bwipjs.toBuffer({
        bcid: 'code128', text: chave,
        scale: 3, height: 16, includetext: false, backgroundcolor: 'ffffff',
      });
      barcode64 = buf.toString('base64');
    } catch (_) {}
  }

  // Logo como base64 PNG
  let logo64 = null;
  if (existsSync(LOGO_PATH)) {
    try { logo64 = readFileSync(LOGO_PATH).toString('base64'); } catch (_) {}
  }

  return {
    emit, dest, nota, itens,
    chave, chaveFormatada, numeroFmt, serie,
    protocoloDisplay, dataEmissao, dataSaida, horaSaida,
    natOp, freteLabel, obsCompl,
    totalProdutos, totalNota, tpAmb,
    barcode64, logo64,
  };
}

// ── DANFE PDF ─────────────────────────────────────────────────────────────────

export async function downloadDANFE(req, res) {
  try {
    const { nota } = req.body;
    if (!nota) return res.status(400).json({ success: false, error: 'Dados da nota não enviados' });

    const dados = await _prepararDadosDanfe(nota);
    const html  = gerarHtmlDanfe(dados);
    const pdf   = await gerarPdfPuppeteer(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${dados.chave || 'DANFE'}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Erro ao gerar DANFE PDF:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
  }
}

// ── DANFE Preview HTML ────────────────────────────────────────────────────────
export async function previewDANFE(req, res) {
  try {
    const { nota } = req.body;
    if (!nota) return res.status(400).json({ success: false, error: 'Dados da nota não enviados' });

    const dados = await _prepararDadosDanfe(nota);
    const html  = gerarHtmlDanfe(dados);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Erro ao gerar preview DANFE:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
  }
}
