import PDFDocument from 'pdfkit';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
const require = createRequire(import.meta.url);
const bwipjs = require('bwip-js');
import { buildNFeXml } from '../services/nfeXmlBuilder.js';
import { assinarXml, autorizarNFe, consultarNFeSefaz, checkStatusSefaz } from '../services/sefazService.js';
import { getInfoCertificado } from '../services/certificadoService.js';
import { proximoNumeroNFe, salvarNFe, buscarNFePorChave, consultarSequencia } from '../services/supabaseNfeService.js';

// Caminho do logo da empresa (5 níveis acima de src/controllers/)
const __dirname_ctrl = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname_ctrl, '..', '..', '..', '..', '..', 'Logo_2026.png');

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
      return res.status(422).json({
        success: false,
        cStat:    resultado.cStat,
        xMotivo:  resultado.xMotivo,
        numero,   // número foi consumido mesmo com rejeição
        error:    `SEFAZ rejeitou a NF-e (${resultado.cStat}): ${resultado.xMotivo}`,
      });
    }

    // ── 4. Salva no Supabase após autorização ─────────────────────────────
    // Salva o nfeProc (XML com protocolo embutido), não apenas o XML assinado
    const xmlParaSalvar = resultado.nfeProcXml || xmlAssinado;
    const valor = itens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
    const notaSalva = await salvarNFe({
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
    const { chave }       = req.params;
    const { justificativa } = req.body;

    if (!justificativa || justificativa.length < 15) {
      return res.status(400).json({ success: false, error: 'Justificativa deve ter pelo menos 15 caracteres' });
    }

    // TODO: implementar envio do evento de cancelamento via NFeRecepcaoEvento4
    console.log('❌ Cancelamento solicitado para:', chave);

    res.json({
      success: false,
      error: 'Cancelamento via evento ainda não implementado nesta versão. Acesse o Portal SEFAZ RO para cancelar manualmente.',
    });
  } catch (error) {
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

// ── DANFE PDF — layout idêntico ao DANFE oficial SEFAZ ────────────────────

export async function downloadDANFE(req, res) {
  try {
    const { nota } = req.body;
    if (!nota) return res.status(400).json({ success: false, error: 'Dados da nota não enviados' });

    // ── Dados emitente (via env) ───────────────────────────────────────────
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
      // FIX #4: label "Fone/Fax:" conforme original
      telefone:   (process.env.EMPRESA_TELEFONE || '').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3'),
    };

    // ── Dados da nota ─────────────────────────────────────────────────────
    const itens = nota.itens?.length > 0 ? nota.itens : [{
      codigo: '', descricao: nota.descricao || 'Serviços/Produtos',
      ncm: '49111090', cfop: '5101', cst: '0102', unidade: 'UN', origem: '0',
      quantidade: 1, valor_unitario: nota.valor, valor_total: nota.valor,
    }];

    // Monta destinatário — prioriza destinatario_json (gravado na emissão)
    let dest = nota.destinatario_json || nota.venda?.cliente || {};
    if (typeof dest === 'string') { try { dest = JSON.parse(dest); } catch (_) { dest = {}; } }
    if (!dest.nome) dest.nome = nota.destinatario_nome || nota.cliente || '';
    if (!dest.cpf_cnpj) dest.cpf_cnpj = nota.destinatario_doc || '';

    const chave       = (nota.chave_acesso || '').replace(/\D/g, '').padEnd(44, '0');
    const chaveGroups = chave.match(/.{1,4}/g)?.join(' ') || chave;
    const serie       = String(nota.serie || '1').padStart(3, '0');
    const numInt      = parseInt(nota.numero || '0');
    const numeroFmt   = numInt > 0
      ? String(numInt).padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
      : '000.000.000';

    const dataEmissao = nota.data ? new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR') : '';
    const dataSaida   = nota.data_saida
      ? new Date(nota.data_saida + 'T00:00:00').toLocaleDateString('pt-BR')
      : dataEmissao;
    const horaSaida   = nota.hora_saida || '';
    const natOp       = nota.natureza_operacao || 'Venda de produção do estabelecimento';
    const tpAmb       = process.env.NODE_ENV === 'producao' ? '1' : '2';

    // FIX #5: Protocolo com data e HORA completa (ex: "211260010218329 - 14/04/2026 15:12:03")
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

    // Informações complementares — semicolons → quebras de linha
    const rawObs = nota.observacoes
      || `EMPRESSA OPTANTE PELO SIMPLES NACIONAL; DADOS BANCARIOS:; SICOOB; AG: 3325 C/C 4.231-5; GRAFICA E EDITORA EXPRESS LTDA ME; OU PIX:; CNPJ ${emit.cnpj}`;
    const obsCompl = rawObs
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .join('\n');

    // FIX #9: Frete — formato igual ao original "(9) Sem Frete"
    const FRETE_LABELS = {
      '0': '(0) Por conta do Emitente',
      '1': '(1) Por conta do Destinatário',
      '2': '(2) Por conta de Terceiros',
      '9': '(9) Sem Frete',
    };
    const modFrete   = String(nota.modalidade_frete || nota.venda?.transporte?.modalidade_frete || '9');
    const freteLabel = FRETE_LABELS[modFrete] || `(${modFrete}) Sem Frete`;

    // Pagamento
    const PAGTO_LABELS = {
      '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de Crédito',
      '04': 'Cartão de Débito', '05': 'PIX', '15': 'Boleto Bancário',
      '90': 'Sem Pagamento', '99': 'Outros',
    };
    const tPag     = String(nota.forma_pagamento || '90');
    const pagLabel = PAGTO_LABELS[tPag] || 'Outros';

    // Formatadores
    const fmt2   = v => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const fmtQtd = v => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const fmtDoc = d => {
      const s = String(d || '').replace(/\D/g, '');
      if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      return d || '';
    };
    // FIX #1: O/CST — formato "0102" igual ao original (sem barra)
    const fmtOCST = item => {
      const orig = String(item.origem || item.orig || '0');
      const cst  = String(item.cst || '');
      if (cst.length === 4) return cst;                        // já "0102"
      if (cst.length === 3) return `${orig}${cst}`;            // "102" → "0102"
      if (cst.length === 2) return `${orig}${cst}`;
      if (cst)              return `${orig}${cst}`;
      return `${orig}102`;
    };

    const totalProdutos  = itens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
    const totalNota      = totalProdutos
      + parseFloat(nota.valor_frete || 0)
      + parseFloat(nota.valor_seguro || 0)
      + parseFloat(nota.outras_despesas || 0)
      - parseFloat(nota.desconto || 0);

    // ── Barcode Code 128 ──────────────────────────────────────────────────
    let barcodeBuf = null;
    try {
      barcodeBuf = await bwipjs.toBuffer({
        bcid: 'code128', text: chave || '00000000000000000000000000000000000000000000',
        scale: 2, height: 12, includetext: false, backgroundcolor: 'ffffff',
      });
    } catch (_) {}

    // FIX #2: Logo da empresa (opcional — não exibe se arquivo não existir)
    const hasLogo = existsSync(LOGO_PATH);

    // ── Configuração do PDF ───────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margin: 0,
      info: { Title: `DANFE NF-e ${chave}`, Author: emit.razao } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${chave || 'DANFE'}.pdf"`);
    doc.pipe(res);

    // ── Constantes de layout ──────────────────────────────────────────────
    // A4: 595 × 842pt  |  margens: 14pt  |  largura útil: 567pt
    const ML = 14, MT = 14, PW = 567;
    const PRETO = '#000000', CINZA = '#555555', BG = '#e8e8e8', VERDE = '#155724';
    const LW = 0.3;

    // ── Helpers ───────────────────────────────────────────────────────────
    const box = (x, y, w, h) =>
      doc.save().lineWidth(LW).rect(x, y, w, h).stroke(PRETO).restore();
    const vl = (x, y, h) =>
      doc.save().lineWidth(LW).moveTo(x, y).lineTo(x, y + h).stroke(PRETO).restore();
    const hl = (x, y, w) =>
      doc.save().lineWidth(LW).moveTo(x, y).lineTo(x + w, y).stroke(PRETO).restore();
    // Rótulo cinza pequeno no topo da célula
    const L = (t, x, y, w) =>
      doc.save().fontSize(5.5).font('Helvetica-Bold').fillColor(CINZA)
         .text(t, x + 2, y + 2, { width: w - 4, lineBreak: false }).restore();
    // Valor centralizado verticalmente na célula (altura padrão 22pt)
    const V = (t, x, y, w, align = 'left', sz = 8, bold = false, cellH = 22) =>
      doc.save().fontSize(sz).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(PRETO)
         .text(String(t ?? ''), x + 2, y + Math.floor((cellH - sz) / 2) + 1,
               { width: w - 4, lineBreak: false, align }).restore();
    // Barra cinza de seção
    const SH = (t, x, y, w) => {
      doc.save().rect(x, y, w, 11).fillAndStroke(BG, PRETO)
         .fontSize(6.5).font('Helvetica-Bold').fillColor(PRETO)
         .text(t, x + 2, y + 2, { width: w - 4, lineBreak: false }).restore();
      return y + 11;
    };

    let y = MT;
    const rH = 22;   // altura padrão de cada linha de dados

    // ════════════════════════════════════════════════════════════════════
    // 1. CANHOTO — tracejado | texto | data/assinatura | NF-e nº
    // ════════════════════════════════════════════════════════════════════
    const cH    = 42;
    const cTxtW = Math.floor(PW * 0.55);
    const cDtW  = Math.floor(PW * 0.25);
    const cNfW  = PW - cTxtW - cDtW;

    doc.save().lineWidth(0.5).dash(3, { space: 2 })
       .rect(ML, y, PW, cH).stroke(PRETO).restore();

    doc.save().fontSize(5.5).font('Helvetica').fillColor(PRETO)
       .text(
         `RECEBEMOS DE ${emit.razao} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ` +
         `ELETRÔNICA INDICADA ABAIXO. EMISSÃO: ${dataEmissao}  VALOR TOTAL: R$ ${fmt2(totalNota)}  ` +
         `DESTINATÁRIO: ${dest.nome || ''}` +
         (dest.logradouro ? ` - ${dest.logradouro}${dest.numero ? ', ' + dest.numero : ''}` : '') +
         (dest.bairro     ? ` - ${dest.bairro}`   : '') +
         (dest.municipio  ? ` - ${dest.municipio}` : '') +
         (dest.uf         ? `/${dest.uf}`          : ''),
         ML + 3, y + 3, { width: cTxtW - 6, lineBreak: true }
       ).restore();
    doc.save().fontSize(7).font('Helvetica-Bold').fillColor(PRETO)
       .text(`NF-e  Nº. ${numeroFmt}  Série ${serie}`, ML + 3, y + cH - 12, { lineBreak: false }).restore();

    vl(ML + cTxtW, y, cH);

    L('DATA DE RECEBIMENTO', ML + cTxtW, y, cDtW);
    hl(ML + cTxtW, y + cH / 2, cDtW);
    L('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', ML + cTxtW, y + cH / 2, cDtW);

    vl(ML + cTxtW + cDtW, y, cH);

    doc.save().fontSize(11).font('Helvetica-Bold').fillColor(PRETO)
       .text('NF-e', ML + cTxtW + cDtW + 2, y + 4,
             { width: cNfW - 4, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(7).font('Helvetica-Bold').fillColor(PRETO)
       .text(`Nº. ${numeroFmt}`, ML + cTxtW + cDtW + 2, y + 18,
             { width: cNfW - 4, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text(`Série ${serie}`, ML + cTxtW + cDtW + 2, y + 28,
             { width: cNfW - 4, align: 'center', lineBreak: false }).restore();

    y += cH;

    // ════════════════════════════════════════════════════════════════════
    // 2. CABEÇALHO — EMITENTE | DANFE | CHAVE + BARCODE
    // ════════════════════════════════════════════════════════════════════
    const hH     = 90;
    const emiW   = Math.floor(PW * 0.50);   // ~283pt
    const danfeW = Math.floor(PW * 0.22);   // ~124pt
    const chvW   = PW - emiW - danfeW;      // ~160pt

    box(ML, y, emiW, hH);
    box(ML + emiW, y, danfeW, hH);
    box(ML + emiW + danfeW, y, chvW, hH);

    // FIX #2: Emitente com logo + FIX #3: CEP sem prefixo + FIX #4: "Fone/Fax:"
    doc.save().fontSize(6).font('Helvetica-Oblique').fillColor(CINZA)
       .text('IDENTIFICAÇÃO DO EMITENTE', ML, y + 3,
             { width: emiW, align: 'center', lineBreak: false }).restore();

    // Logo (se existir, exibe no lugar de razão social — centralizado)
    let razaoY = y + 14;
    if (hasLogo) {
      try {
        doc.image(LOGO_PATH, ML + Math.floor(emiW / 2) - 30, y + 8, { width: 60, height: 20 });
        razaoY = y + 32;
      } catch (_) {}
    }
    doc.save().fontSize(9.5).font('Helvetica-Bold').fillColor(PRETO)
       .text(emit.razao, ML + 4, razaoY,
             { width: emiW - 8, align: 'center', lineBreak: true }).restore();
    // Linha 1: Logradouro, Número
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text(`${emit.logradouro}${emit.numero ? ', ' + emit.numero : ''}`,
             ML + 4, y + 54, { width: emiW - 8, align: 'center', lineBreak: false }).restore();
    // Linha 2: Bairro - CEP (sem prefixo "CEP:")
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text(`${emit.bairro}${emit.cep ? ' - ' + emit.cep : ''}`,
             ML + 4, y + 63, { width: emiW - 8, align: 'center', lineBreak: false }).restore();
    // Linha 3: Município - UF  Fone/Fax: (69) XXXX-XXXX
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text(`${emit.municipio}${emit.uf ? ' - ' + emit.uf : ''}` +
             `${emit.telefone ? ' Fone/Fax: ' + emit.telefone : ''}`,
             ML + 4, y + 72, { width: emiW - 8, align: 'center', lineBreak: false }).restore();

    // Coluna DANFE (central)
    const dX = ML + emiW;
    doc.save().fontSize(16).font('Helvetica-Bold').fillColor(PRETO)
       .text('DANFE', dX, y + 6, { width: danfeW, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(5.5).font('Helvetica').fillColor(PRETO)
       .text('Documento Auxiliar da',  dX, y + 27, { width: danfeW, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(5.5).font('Helvetica').fillColor(PRETO)
       .text('Nota Fiscal Eletrônica', dX, y + 34, { width: danfeW, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text('0 - ENTRADA', dX + 6, y + 45, { lineBreak: false }).restore();
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text('1 - SAÍDA',   dX + 6, y + 54, { lineBreak: false }).restore();
    // Caixa "1" (saída)
    doc.save().lineWidth(1.5).rect(dX + danfeW - 22, y + 50, 16, 14).stroke(PRETO)
       .fontSize(9).font('Helvetica-Bold').fillColor(PRETO)
       .text('1', dX + danfeW - 22, y + 52, { width: 16, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(8).font('Helvetica-Bold').fillColor(PRETO)
       .text(`Nº. ${numeroFmt}`, dX, y + 68, { width: danfeW, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text(`Série ${serie}`, dX, y + 78, { width: danfeW, align: 'center', lineBreak: false }).restore();
    doc.save().fontSize(6).font('Helvetica').fillColor(CINZA)
       .text('Folha 1/1', dX, y + 83, { width: danfeW, align: 'center', lineBreak: false }).restore();

    // Coluna Chave + Barcode
    const cX = ML + emiW + danfeW;
    let cvY = y + 3;
    if (barcodeBuf) {
      doc.image(barcodeBuf, cX + 4, cvY, { width: chvW - 8, height: 22 });
      cvY += 25;
    }
    doc.save().fontSize(5.5).font('Helvetica-Bold').fillColor(CINZA)
       .text('CHAVE DE ACESSO', cX + 2, cvY, { width: chvW - 4, lineBreak: false }).restore();
    cvY += 8;
    doc.save().fontSize(5.8).font('Courier-Bold').fillColor(PRETO)
       .text(chaveGroups, cX + 2, cvY, { width: chvW - 4, align: 'center', lineBreak: true }).restore();
    cvY += 18;
    doc.save().fontSize(5.5).font('Helvetica').fillColor(PRETO)
       .text('Consulta de autenticidade no portal nacional da NF-e:',
             cX + 2, cvY, { width: chvW - 4, lineBreak: false }).restore();
    cvY += 8;
    doc.save().fontSize(5.5).font('Helvetica').fillColor(PRETO)
       .text('www.nfe.fazenda.gov.br/portal',
             cX + 2, cvY, { width: chvW - 4, lineBreak: false }).restore();

    y += hH;

    // ════════════════════════════════════════════════════════════════════
    // 3. NATUREZA DA OPERAÇÃO | PROTOCOLO DE AUTORIZAÇÃO
    // ════════════════════════════════════════════════════════════════════
    const natW  = Math.floor(PW * 0.55);
    const protW = PW - natW;

    box(ML, y, natW, rH);
    box(ML + natW, y, protW, rH);
    // FIX #11: Natureza em bold maior, centralizada, igual ao original
    L('NATUREZA DA OPERAÇÃO', ML, y, natW);
    doc.save().fontSize(9).font('Helvetica-Bold').fillColor(PRETO)
       .text(natOp, ML + 2, y + 9, { width: natW - 4, align: 'center', lineBreak: false }).restore();
    L('PROTOCOLO DE AUTORIZAÇÃO DE USO', ML + natW, y, protW);
    doc.save().fontSize(7.5).font('Helvetica-Bold')
       .fillColor(nota.protocolo ? VERDE : CINZA)
       .text(protocoloDisplay, ML + natW + 2, y + 9,
             { width: protW - 4, lineBreak: false }).restore();
    y += rH;

    // ════════════════════════════════════════════════════════════════════
    // 4. INSCRIÇÃO ESTADUAL | IE SUBST. TRIBUT. | CNPJ/CPF EMITENTE
    // ════════════════════════════════════════════════════════════════════
    const ieW    = Math.floor(PW * 0.25);
    const ieSubW = Math.floor(PW * 0.37);
    const cnpjEW = PW - ieW - ieSubW;

    box(ML, y, ieW, rH);
    box(ML + ieW, y, ieSubW, rH);
    box(ML + ieW + ieSubW, y, cnpjEW, rH);
    L('INSCRIÇÃO ESTADUAL', ML, y, ieW);
    V(emit.ie || '', ML, y, ieW, 'left', 8, true);
    L('INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.', ML + ieW, y, ieSubW);
    L('CNPJ / CPF', ML + ieW + ieSubW, y, cnpjEW);
    V(emit.cnpj, ML + ieW + ieSubW, y, cnpjEW, 'left', 8, true);
    y += rH;

    // ════════════════════════════════════════════════════════════════════
    // 5. DESTINATÁRIO / REMETENTE
    // ════════════════════════════════════════════════════════════════════
    y = SH('DESTINATÁRIO / REMETENTE', ML, y, PW);

    // Linha 1: Nome | CNPJ/CPF | Data Emissão
    const nomW   = Math.floor(PW * 0.60);
    const cnpjDW = Math.floor(PW * 0.22);
    const dtEmW  = PW - nomW - cnpjDW;

    box(ML, y, nomW, rH);
    box(ML + nomW, y, cnpjDW, rH);
    box(ML + nomW + cnpjDW, y, dtEmW, rH);
    L('NOME / RAZÃO SOCIAL', ML, y, nomW);
    V(dest.nome || '', ML, y, nomW, 'left', 8, true);
    L('CNPJ / CPF', ML + nomW, y, cnpjDW);
    V(fmtDoc(dest.cpf_cnpj), ML + nomW, y, cnpjDW, 'left', 8, true);
    L('DATA DA EMISSÃO', ML + nomW + cnpjDW, y, dtEmW);
    V(dataEmissao, ML + nomW + cnpjDW, y, dtEmW, 'center', 8, true);
    y += rH;

    // Linha 2: Endereço | Bairro | CEP | Data Saída
    const endW  = Math.floor(PW * 0.52);
    const baiW  = Math.floor(PW * 0.24);
    const cepW  = Math.floor(PW * 0.12);
    const dtSaW = PW - endW - baiW - cepW;

    box(ML, y, endW, rH);
    box(ML + endW, y, baiW, rH);
    box(ML + endW + baiW, y, cepW, rH);
    box(ML + endW + baiW + cepW, y, dtSaW, rH);
    L('ENDEREÇO', ML, y, endW);
    V(dest.logradouro
        ? `${dest.logradouro}${dest.numero ? ', ' + dest.numero : ''}` +
          `${dest.complemento ? ' - ' + dest.complemento : ''}`
        : '', ML, y, endW, 'left', 8, true);
    L('BAIRRO / DISTRITO', ML + endW, y, baiW);
    V(dest.bairro || '', ML + endW, y, baiW, 'left', 8, true);
    L('CEP', ML + endW + baiW, y, cepW);
    V(dest.cep ? String(dest.cep).replace(/(\d{5})(\d{3})/, '$1-$2') : '',
      ML + endW + baiW, y, cepW, 'center', 8, false);
    L('DATA DA SAÍDA', ML + endW + baiW + cepW, y, dtSaW);
    V(dataSaida, ML + endW + baiW + cepW, y, dtSaW, 'center', 8, true);
    y += rH;

    // Linha 3: Município | UF | Fone/Fax | IE Dest. | Hora Saída
    const munW = Math.floor(PW * 0.30);
    const ufDW = 28;
    const fonW = Math.floor(PW * 0.22);
    const ieDW = Math.floor(PW * 0.24);
    const hrW  = PW - munW - ufDW - fonW - ieDW;

    box(ML, y, munW, rH);
    box(ML + munW, y, ufDW, rH);
    box(ML + munW + ufDW, y, fonW, rH);
    box(ML + munW + ufDW + fonW, y, ieDW, rH);
    box(ML + munW + ufDW + fonW + ieDW, y, hrW, rH);
    L('MUNICÍPIO', ML, y, munW);
    V(dest.municipio || '', ML, y, munW, 'left', 8, true);
    L('UF', ML + munW, y, ufDW);
    V(dest.uf || '', ML + munW, y, ufDW, 'center', 8, true);
    L('FONE / FAX', ML + munW + ufDW, y, fonW);
    V(dest.telefone || '', ML + munW + ufDW, y, fonW, 'left', 7, false);
    L('INSCRIÇÃO ESTADUAL', ML + munW + ufDW + fonW, y, ieDW);
    V(dest.inscricao_estadual || dest.ie || '', ML + munW + ufDW + fonW, y, ieDW, 'left', 7, false);
    L('HORA DA SAÍDA', ML + munW + ufDW + fonW + ieDW, y, hrW);
    V(horaSaida, ML + munW + ufDW + fonW + ieDW, y, hrW, 'center', 8, true);
    y += rH;

    // ════════════════════════════════════════════════════════════════════
    // 6. CÁLCULO DO IMPOSTO — 2 linhas × 6 colunas
    // ════════════════════════════════════════════════════════════════════
    y = SH('CÁLCULO DO IMPOSTO', ML, y, PW);

    const impW6 = Math.floor(PW / 6);
    const impWs = [impW6, impW6, impW6, impW6, impW6, PW - 5 * impW6];
    const impX  = i => ML + impWs.slice(0, i).reduce((s, w) => s + w, 0);

    // Extrai totais da nota se disponíveis
    const bcICMS = fmt2(nota.totais?.bc_icms || 0);
    const vlICMS = fmt2(nota.totais?.valor_icms || 0);
    const bcST   = fmt2(nota.totais?.bc_icms_st || 0);
    const vlST   = fmt2(nota.totais?.valor_icms_st || 0);
    const vlFrt  = fmt2(nota.valor_frete || nota.totais?.valor_frete || 0);
    const vlSeg  = fmt2(nota.valor_seguro || nota.totais?.valor_seguro || 0);
    const vlDesc = fmt2(nota.desconto || nota.totais?.desconto || 0);
    const vlDesp = fmt2(nota.outras_despesas || nota.totais?.valor_despesas || 0);
    const vlIPI  = fmt2(nota.valor_ipi || nota.totais?.valor_ipi || 0);

    [
      ['BASE DE CÁLCULO DO ICMS',  bcICMS],
      ['VALOR DO ICMS',            vlICMS],
      ['BASE DE CÁLC. ICMS S.T.',  bcST],
      ['VALOR DO ICMS SUBST.',     vlST],
      ['VALOR IMP. IMPORTAÇÃO',    '0,00'],
      ['VALOR TOTAL DOS PRODUTOS', fmt2(totalProdutos)],
    ].forEach(([l, v], i) => {
      box(impX(i), y, impWs[i], rH);
      L(l, impX(i), y, impWs[i]);
      doc.save().fontSize(9).font('Helvetica-Bold').fillColor(PRETO)
         .text(v, impX(i) + 2, y + 9, { width: impWs[i] - 4, align: 'right', lineBreak: false }).restore();
    });
    y += rH;

    [
      ['VALOR DO FRETE',      vlFrt],
      ['VALOR DO SEGURO',     vlSeg],
      ['DESCONTO',            vlDesc],
      ['OUTRAS DESPESAS',     vlDesp],
      ['VALOR TOTAL DO IPI',  vlIPI],
      ['VALOR TOTAL DA NOTA', fmt2(totalNota)],
    ].forEach(([l, v], i) => {
      box(impX(i), y, impWs[i], rH);
      L(l, impX(i), y, impWs[i]);
      doc.save().fontSize(9).font('Helvetica-Bold').fillColor(PRETO)
         .text(v, impX(i) + 2, y + 9, { width: impWs[i] - 4, align: 'right', lineBreak: false }).restore();
    });
    y += rH;

    // ════════════════════════════════════════════════════════════════════
    // 7. TRANSPORTADOR / VOLUMES TRANSPORTADOS
    // ════════════════════════════════════════════════════════════════════
    y = SH('TRANSPORTADOR / VOLUMES TRANSPORTADOS', ML, y, PW);

    // Linha 1: Nome | Frete | ANTT | Placa | UF | CNPJ
    const trNomW  = Math.floor(PW * 0.38);
    const trFrtW  = Math.floor(PW * 0.18);
    const trAnttW = Math.floor(PW * 0.15);
    const trPlacW = Math.floor(PW * 0.11);
    const trUf1W  = 30;
    const trCnpjW = PW - trNomW - trFrtW - trAnttW - trPlacW - trUf1W;

    box(ML, y, trNomW, rH);
    box(ML + trNomW, y, trFrtW, rH);
    box(ML + trNomW + trFrtW, y, trAnttW, rH);
    box(ML + trNomW + trFrtW + trAnttW, y, trPlacW, rH);
    box(ML + trNomW + trFrtW + trAnttW + trPlacW, y, trUf1W, rH);
    box(ML + trNomW + trFrtW + trAnttW + trPlacW + trUf1W, y, trCnpjW, rH);
    L('NOME / RAZÃO SOCIAL', ML, y, trNomW);
    L('FRETE POR CONTA', ML + trNomW, y, trFrtW);
    V(freteLabel, ML + trNomW, y, trFrtW, 'center', 6.5, true);
    L('CÓDIGO ANTT', ML + trNomW + trFrtW, y, trAnttW);
    L('PLACA DO VEÍCULO', ML + trNomW + trFrtW + trAnttW, y, trPlacW);
    L('UF', ML + trNomW + trFrtW + trAnttW + trPlacW, y, trUf1W);
    L('CNPJ / CPF', ML + trNomW + trFrtW + trAnttW + trPlacW + trUf1W, y, trCnpjW);
    y += rH;

    // Linha 2: Endereço | Município | UF | IE
    const trEndW = Math.floor(PW * 0.44);
    const trMunW = Math.floor(PW * 0.30);
    const trUf2W = 30;
    const trIe2W = PW - trEndW - trMunW - trUf2W;
    const trR2H  = 18;

    box(ML, y, trEndW, trR2H);
    box(ML + trEndW, y, trMunW, trR2H);
    box(ML + trEndW + trMunW, y, trUf2W, trR2H);
    box(ML + trEndW + trMunW + trUf2W, y, trIe2W, trR2H);
    L('ENDEREÇO', ML, y, trEndW);
    L('MUNICÍPIO', ML + trEndW, y, trMunW);
    L('UF', ML + trEndW + trMunW, y, trUf2W);
    L('INSCRIÇÃO ESTADUAL', ML + trEndW + trMunW + trUf2W, y, trIe2W);
    y += trR2H;

    // Linha 3: Qtd | Espécie | Marca | Numeração | Peso Bruto | Peso Líquido
    const trV6  = Math.floor(PW / 6);
    const trVs  = [trV6, trV6, trV6, trV6, trV6, PW - 5 * trV6];
    const trR3H = 18;
    let vx = ML;
    const trTransp = nota.venda?.transporte || {};
    const volQtd   = trTransp.volumes?.quantidade || 0;
    const pBruto   = parseFloat(trTransp.peso_bruto  || 0).toFixed(3).replace('.', ',');
    const pLiq     = parseFloat(trTransp.peso_liquido || 0).toFixed(3).replace('.', ',');
    [
      ['QUANTIDADE', String(volQtd)],
      ['ESPÉCIE',    trTransp.volumes?.especie   || ''],
      ['MARCA',      trTransp.volumes?.marca     || ''],
      ['NUMERAÇÃO',  trTransp.volumes?.numeracao || ''],
      ['PESO BRUTO', pBruto],
      ['PESO LÍQUIDO', pLiq],
    ].forEach(([l, v], i) => {
      box(vx, y, trVs[i], trR3H);
      L(l, vx, y, trVs[i]);
      if (v) V(v, vx, y, trVs[i], i >= 4 ? 'right' : 'left', 7.5, true, trR3H);
      vx += trVs[i];
    });
    y += trR3H;

    // ════════════════════════════════════════════════════════════════════
    // 8. DADOS DOS PRODUTOS / SERVIÇOS — 14 colunas DANFE oficial
    // ════════════════════════════════════════════════════════════════════
    y = SH('DADOS DOS PRODUTOS / SERVIÇOS', ML, y, PW);

    const cols = [
      { h: 'CÓDIGO\nPRODUTO',                w: 32,  align: 'center' },
      { h: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', w: 0,   align: 'left'   }, // flex
      { h: 'NCM/SH',                         w: 46,  align: 'center' },
      { h: 'O/CST',                          w: 26,  align: 'center' },
      { h: 'CFOP',                           w: 26,  align: 'center' },
      { h: 'UN',                             w: 18,  align: 'center' },
      { h: 'QUANT.',                         w: 40,  align: 'right'  },
      { h: 'VALOR\nUNIT.',                   w: 44,  align: 'right'  },
      { h: 'VALOR\nTOTAL',                   w: 44,  align: 'right'  },
      { h: 'B.CÁLC\nICMS',                   w: 36,  align: 'right'  },
      { h: 'VALOR\nICMS',                    w: 36,  align: 'right'  },
      { h: 'VALOR\nIPI',                     w: 34,  align: 'right'  },
      { h: 'ALÍQ.\nICMS',                    w: 28,  align: 'right'  },
      { h: 'ALÍQ.\nIPI',                     w: 28,  align: 'right'  },
    ];
    const fixedW = cols.reduce((s, c) => s + c.w, 0);
    cols[1].w = PW - fixedW;   // coluna descrição ocupa o espaço restante

    const thH = 16;
    let cx = ML;
    cols.forEach(c => {
      box(cx, y, c.w, thH);
      doc.save().fontSize(5).font('Helvetica-Bold').fillColor(CINZA)
         .text(c.h, cx + 1, y + 2, { width: c.w - 2, align: 'center', lineBreak: true }).restore();
      cx += c.w;
    });
    y += thH;

    const rowH = 13;
    // Linhas dos itens
    itens.forEach(item => {
      const row = [
        item.produto?.codigo || item.codigo || '',
        item.descricao || item.produto?.nome || '',
        item.ncm || item.produto?.ncm || '49111090',
        fmtOCST(item),
        item.cfop || '5101',
        item.produto?.unidade_medida || item.unidade || 'UN',
        fmtQtd(item.quantidade || 1),
        fmt2(item.valor_unitario || 0),
        fmt2(item.valor_total    || 0),
        fmt2(item.bcalc_icms     || 0),
        fmt2(item.valor_icms     || 0),
        fmt2(item.valor_ipi      || 0),
        // FIX #6: ALÍQ. ICMS e ALÍQ. IPI sempre "0,00" (conforme original)
        item.aliq_icms != null ? fmt2(item.aliq_icms) : '0,00',
        item.aliq_ipi  != null ? fmt2(item.aliq_ipi)  : '0,00',
      ];
      cx = ML;
      cols.forEach((c, i) => {
        box(cx, y, c.w, rowH);
        doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
           .text(row[i], cx + 1, y + 2,
                 { width: c.w - 2, align: c.align, lineBreak: false, ellipsis: true }).restore();
        cx += c.w;
      });
      y += rowH;
    });

    // FIX #8: Linhas vazias pontilhadas abaixo dos itens (preenche até dados adicionais)
    const pageBottom  = 842 - 14;
    const daNeeded    = 11 + 80 + 14 + 6;   // SH + content + footer + gap
    const tableBottom = pageBottom - daNeeded;
    while (y + rowH <= tableBottom) {
      cx = ML;
      cols.forEach(c => {
        doc.save().lineWidth(0.3).dash(2, { space: 2 })
           .rect(cx, y, c.w, rowH).stroke(PRETO).restore();
        cx += c.w;
      });
      y += rowH;
    }

    // ════════════════════════════════════════════════════════════════════
    // 9. DADOS ADICIONAIS — [INFORMAÇÕES COMPLEMENTARES | RESERVADO AO FISCO]
    //    FIX #7: sem QR code (igual à original)
    // ════════════════════════════════════════════════════════════════════
    const daHeaderH  = 11;
    const daContentH = 80;
    const footerH    = 16;
    const neededH    = daHeaderH + daContentH + footerH + 4;
    const daTopY     = Math.max(y + 2, pageBottom - neededH);

    y = SH('DADOS ADICIONAIS', ML, daTopY, PW);

    const infoW  = Math.floor(PW * 0.68);
    const fiscoW = PW - infoW;
    const daH    = Math.max(daContentH, pageBottom - footerH - 2 - y);

    box(ML, y, infoW, daH);
    L('INFORMAÇÕES COMPLEMENTARES', ML, y, infoW);
    doc.save().fontSize(6.5).font('Helvetica').fillColor(PRETO)
       .text(obsCompl, ML + 3, y + 12, { width: infoW - 6, lineBreak: true }).restore();

    box(ML + infoW, y, fiscoW, daH);
    L('RESERVADO AO FISCO', ML + infoW, y, fiscoW);

    y += daH;

    // ════════════════════════════════════════════════════════════════════
    // 10. RODAPÉ — FIX #10: formato "DD/MM/YYYY HH:MM:SS   Sistema ERP"
    // ════════════════════════════════════════════════════════════════════
    const rodapeDataHora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Porto_Velho',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).replace(',', '');
    const sistemaLabel = process.env.SISTEMA_NOME || 'Sistema ERP Gráfica Expressa';
    doc.save().fontSize(6).font('Helvetica').fillColor(CINZA)
       .text(`${rodapeDataHora}   ${sistemaLabel}`, ML, y + 3,
             { width: PW, lineBreak: false }).restore();

    // Marca d'água — ambiente de homologação
    if (tpAmb === '2') {
      doc.save()
         .fontSize(52).font('Helvetica-Bold').fillColor('#cccccc').opacity(0.28)
         .rotate(-45, { origin: [297, 421] })
         .text('SEM VALOR FISCAL', 60, 360, { width: 480, align: 'center', lineBreak: false })
         .restore();
    }

    doc.end();
  } catch (error) {
    console.error('Erro ao gerar DANFE PDF:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
  }
}
