import { parseStringPromise } from 'xml2js';
import { gerarDanfePdfmake } from '../services/danfePdfmake.js';
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

// ── DANFE PDF — layout idêntico ao DANFE oficial SEFAZ ────────────────────

export async function downloadDANFE(req, res) {
  try {
    let { nota } = req.body;
    if (!nota) return res.status(400).json({ success: false, error: 'Dados da nota não enviados' });

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

    // ── Normaliza campos — garante mesma estrutura independente da origem ──
    // Campos financeiros no nível raiz (preview envia dentro de totais)
    if (nota.valor_frete     == null) nota.valor_frete     = parseFloat(nota.totais?.valor_frete    || 0);
    if (nota.valor_seguro    == null) nota.valor_seguro    = parseFloat(nota.totais?.valor_seguro   || 0);
    if (nota.desconto        == null) nota.desconto        = parseFloat(nota.totais?.desconto       || 0);
    if (nota.outras_despesas == null) nota.outras_despesas = parseFloat(nota.totais?.valor_despesas || nota.totais?.outras_despesas || 0);

    // Normaliza itens: origem padrão '0', CST no formato 4 dígitos (ex: "102" → "0102")
    if (nota.itens?.length) {
      nota.itens = nota.itens.map(it => ({
        ...it,
        origem: it.origem ?? '0',
        cst: it.cst
          ? (String(it.cst).length < 4 ? `0${it.cst}` : String(it.cst))
          : '0102',
      }));
    }

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

    // ── Gera PDF via pdfmake ──────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${chave || 'DANFE'}.pdf"`);

    const pdfBuffer = await gerarDanfePdfmake({
      nota, emit, itens, dest,
      chave, chaveGroups, serie, numeroFmt,
      dataEmissao, dataSaida, horaSaida,
      natOp, protocoloDisplay, freteLabel, obsCompl,
      fmt2, fmtQtd, fmtDoc, fmtOCST,
      totalProdutos, totalNota,
      bcICMS, vlICMS, bcST, vlST,
      vlFrt, vlSeg, vlDesc, vlDesp, vlIPI,
      tpAmb,
    });
    res.end(pdfBuffer);

    // (renderização delegada ao serviço danfePdfmake.js)
  } catch (error) {
    console.error('Erro ao gerar DANFE PDF:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
  }
}
