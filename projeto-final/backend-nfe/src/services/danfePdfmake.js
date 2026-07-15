import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const pdfMake = require('pdfmake/build/pdfmake');
pdfMake.vfs   = require('pdfmake/build/vfs_fonts');
const bwipjs  = require('bwip-js');

const __dir   = dirname(fileURLToPath(import.meta.url));
export const LOGO_PATH = join(__dir, '../../../assets/Logo_2026.png');

// ─── Constantes ───────────────────────────────────────────────────────────────
const PW    = 567;          // largura útil A4 (595 - 2×14pt margens)
const CINZA = '#666666';
const PRETO = '#000000';
const BG    = '#e0e0e0';    // fundo dos cabeçalhos de seção

// ─── Layout padrão: bordas finas (0.5pt) pretas ───────────────────────────────
const thin = {
  hLineWidth:    () => 0.5,
  vLineWidth:    () => 0.5,
  hLineColor:    () => PRETO,
  vLineColor:    () => PRETO,
  paddingLeft:   () => 2,
  paddingRight:  () => 2,
  paddingTop:    () => 1,
  paddingBottom: () => 1,
};

// ─── Helper: célula label (cinza pequeno) + valor (preto bold) ─────────────────
function lv(label, value, opts = {}) {
  const { align = 'left', bold = true, size = 7.5 } = opts;
  return {
    stack: [
      { text: label, fontSize: 5, color: CINZA, bold: true },
      { text: String(value ?? ''), fontSize: size, bold, color: PRETO, alignment: align },
    ],
  };
}

// ─── Helper: tabela com bordas finas ──────────────────────────────────────────
function tbl(widths, body, layout) {
  return {
    table: { widths, body },
    layout: layout || thin,
    margin: [0, 0, 0, 0],
  };
}

// ─── Helper: cabeçalho de seção (fundo cinza) ────────────────────────────────
function sh(text) {
  return tbl([PW], [[{
    text, fontSize: 6, bold: true, color: PRETO,
    fillColor: BG, margin: [2, 1, 2, 1],
  }]]);
}

// ─── Layout da caixa "1" (Saída) no DANFE ────────────────────────────────────
const boxLayout = {
  hLineWidth: () => 1.5, vLineWidth: () => 1.5,
  hLineColor: () => PRETO, vLineColor: () => PRETO,
  paddingLeft: () => 2, paddingRight: () => 2,
  paddingTop: () => 0, paddingBottom: () => 0,
};

// ═════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL — recebe todos os dados já preparados pelo controller
// ═════════════════════════════════════════════════════════════════════════════
export async function gerarDanfePdfmake(d) {
  const {
    nota, emit, itens, dest,
    chave, chaveGroups, serie, numeroFmt,
    dataEmissao, dataSaida, horaSaida,
    natOp, protocoloDisplay, freteLabel, obsCompl,
    fmt2, fmtQtd, fmtDoc, fmtOCST,
    totalProdutos, totalNota,
    bcICMS, vlICMS, bcST, vlST,
    vlFrt, vlSeg, vlDesc, vlDesp, vlIPI,
    tpAmb,
  } = d;

  // ── Barcode Code128 ───────────────────────────────────────────────────────
  const chaveReal = chave && chave.replace(/0/g, '').length > 0;
  let barcodeDataUrl = null;
  if (chaveReal) {
    try {
      const buf = await bwipjs.toBuffer({
        bcid: 'code128', text: chave,
        scale: 2, height: 10, includetext: false, backgroundcolor: 'ffffff',
      });
      barcodeDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    } catch (_) {}
  }

  // ── Logo da empresa ───────────────────────────────────────────────────────
  let logoDataUrl = null;
  if (existsSync(LOGO_PATH)) {
    try {
      logoDataUrl = `data:image/png;base64,${readFileSync(LOGO_PATH).toString('base64')}`;
    } catch (_) {}
  }

  // ── Helper de larguras ────────────────────────────────────────────────────
  const W = (...fracs) => fracs.map(f => Math.round(PW * f));

  // ══════════════════════════════════════════════════════════════════════════
  // 1. CANHOTO
  // ══════════════════════════════════════════════════════════════════════════
  const [cTxtW, cDtW] = W(0.55, 0.25);
  const cNfW = PW - cTxtW - cDtW;

  const canhotoTexto =
    `RECEBEMOS DE ${emit.razao} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA ` +
    `INDICADA ABAIXO. EMISSÃO: ${dataEmissao}  VALOR TOTAL: R$ ${fmt2(totalNota)}  ` +
    `DESTINATÁRIO: ${dest.nome || ''}` +
    (dest.logradouro ? ` - ${dest.logradouro}${dest.numero ? ', ' + dest.numero : ''}` : '') +
    (dest.bairro     ? ` - ${dest.bairro}`    : '') +
    (dest.municipio  ? ` - ${dest.municipio}` : '') +
    (dest.uf         ? `/${dest.uf}`          : '');

  const canhoto = {
    table: {
      widths: [cTxtW, cDtW, cNfW],
      heights: [46],
      body: [[
        {
          stack: [
            { text: canhotoTexto, fontSize: 5 },
            { text: `NF-e  Nº. ${numeroFmt}  Série ${serie}`, fontSize: 7, bold: true, margin: [0, 6, 0, 0] },
          ],
          margin: [2, 2, 2, 2],
        },
        {
          stack: [
            { text: 'DATA DE RECEBIMENTO', fontSize: 5, color: CINZA, bold: true },
            { canvas: [{ type: 'line', x1: 0, y1: 14, x2: cDtW - 6, y2: 14, lineWidth: 0.5 }], margin: [0, 0, 0, 2] },
            { text: 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', fontSize: 5, color: CINZA, bold: true },
          ],
          margin: [2, 2, 2, 2],
        },
        {
          stack: [
            { text: 'NF-e', fontSize: 11, bold: true, alignment: 'center' },
            { text: `Nº. ${numeroFmt}`, fontSize: 7, bold: true, alignment: 'center' },
            { text: `Série ${serie}`, fontSize: 6.5, alignment: 'center' },
          ],
          margin: [2, 8, 2, 2],
        },
      ]],
    },
    layout: thin,
    margin: [0, 0, 0, 0],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 2. CABEÇALHO — EMITENTE | DANFE | CHAVE + BARCODE
  // ══════════════════════════════════════════════════════════════════════════
  const [emiW, danfeW] = W(0.50, 0.20);
  const chvW = PW - emiW - danfeW;

  // Coluna emitente
  const emiStack = [
    { text: 'IDENTIFICAÇÃO DO EMITENTE', fontSize: 5.5, italics: true, color: CINZA, alignment: 'center' },
  ];
  if (logoDataUrl) {
    emiStack.push({ image: logoDataUrl, width: Math.min(emiW - 20, 120), alignment: 'center', margin: [0, 2, 0, 2] });
  }
  emiStack.push({ text: emit.razao, fontSize: 9.5, bold: true, alignment: 'center', margin: [0, logoDataUrl ? 0 : 8, 0, 0] });
  if (emit.logradouro) emiStack.push({ text: `${emit.logradouro}${emit.numero ? ', ' + emit.numero : ''}`, fontSize: 6.5, alignment: 'center' });
  if (emit.bairro || emit.cep) emiStack.push({ text: `${emit.bairro}${emit.cep ? ' - ' + emit.cep : ''}`, fontSize: 6.5, alignment: 'center' });
  emiStack.push({ text: `${emit.municipio}${emit.uf ? ' - ' + emit.uf : ''}${emit.telefone ? '  Fone/Fax: ' + emit.telefone : ''}`, fontSize: 6.5, alignment: 'center' });

  // Coluna DANFE
  const danfeStack = [
    { text: 'DANFE', fontSize: 16, bold: true, alignment: 'center' },
    { text: 'Documento Auxiliar da', fontSize: 5.5, alignment: 'center' },
    { text: 'Nota Fiscal Eletrônica', fontSize: 5.5, alignment: 'center', margin: [0, 0, 0, 4] },
    {
      columns: [
        { text: '0 - ENTRADA\n1 - SAÍDA', fontSize: 6.5, width: '*' },
        {
          table: { widths: [14], body: [[{ text: '1', fontSize: 9, bold: true, alignment: 'center', margin: [0, 1, 0, 0] }]] },
          layout: boxLayout,
          width: 18,
        },
      ],
      margin: [4, 0, 4, 4],
    },
    { text: `Nº. ${numeroFmt}`, fontSize: 8, bold: true, alignment: 'center' },
    { text: `Série ${serie}`, fontSize: 6.5, alignment: 'center' },
    { text: 'Folha 1/1', fontSize: 6, color: CINZA, alignment: 'center' },
  ];

  // Coluna chave + barcode
  const chvStack = [];
  if (barcodeDataUrl) {
    chvStack.push({ image: barcodeDataUrl, width: chvW - 8, height: 20, alignment: 'center', margin: [0, 2, 0, 2] });
  }
  chvStack.push({ text: 'CHAVE DE ACESSO', fontSize: 5, color: CINZA, bold: true });
  chvStack.push({ text: chaveGroups, fontSize: 5.2, bold: true, alignment: 'center', margin: [0, 1, 0, 4] });
  chvStack.push({ text: 'Consulta de autenticidade no portal nacional da NF-e', fontSize: 5 });
  chvStack.push({ text: 'www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', fontSize: 5 });

  const cabecalho = {
    table: {
      widths: [emiW, danfeW, chvW],
      body: [[
        { stack: emiStack,   margin: [2, 2, 2, 4] },
        { stack: danfeStack, margin: [2, 4, 2, 2] },
        { stack: chvStack,   margin: [2, 2, 2, 2] },
      ]],
    },
    layout: thin,
    margin: [0, 0, 0, 0],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 3. NATUREZA DA OPERAÇÃO | PROTOCOLO DE AUTORIZAÇÃO
  // ══════════════════════════════════════════════════════════════════════════
  const [natW] = W(0.55);
  const protW  = PW - natW;

  const natProt = tbl([natW, protW], [[
    lv('NATUREZA DA OPERAÇÃO', natOp, { align: 'center', size: 9 }),
    lv('PROTOCOLO DE AUTORIZAÇÃO DE USO', protocoloDisplay, { size: 7 }),
  ]]);

  // ══════════════════════════════════════════════════════════════════════════
  // 4. IE EMITENTE | IE SUBST. TRIBUT. | CNPJ/CPF
  // ══════════════════════════════════════════════════════════════════════════
  const [ieW, ieSubW] = W(0.25, 0.37);
  const cnpjEW = PW - ieW - ieSubW;

  const ieRow = tbl([ieW, ieSubW, cnpjEW], [[
    lv('INSCRIÇÃO ESTADUAL', emit.ie || ''),
    lv('INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.', ''),
    lv('CNPJ / CPF', emit.cnpj),
  ]]);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. DESTINATÁRIO / REMETENTE
  // ══════════════════════════════════════════════════════════════════════════
  const [nomW, cnpjDW] = W(0.60, 0.22);
  const dtEmW = PW - nomW - cnpjDW;

  const [endW, baiW, cepW] = W(0.52, 0.24, 0.12);
  const dtSaW = PW - endW - baiW - cepW;

  const [munW] = W(0.30);
  const ufDW   = 28;
  const [fonW, ieDW] = W(0.22, 0.24);
  const hrW = PW - munW - ufDW - fonW - ieDW;

  const enderecoFull = dest.logradouro
    ? `${dest.logradouro}${dest.numero ? ', ' + dest.numero : ''}${dest.complemento ? ' - ' + dest.complemento : ''}`
    : '';

  const destinatario = [
    sh('DESTINATÁRIO / REMETENTE'),
    tbl([nomW, cnpjDW, dtEmW], [[
      lv('NOME / RAZÃO SOCIAL', dest.nome || ''),
      lv('CNPJ / CPF', fmtDoc(dest.cpf_cnpj)),
      lv('DATA DA EMISSÃO', dataEmissao, { align: 'center' }),
    ]]),
    tbl([endW, baiW, cepW, dtSaW], [[
      lv('ENDEREÇO', enderecoFull),
      lv('BAIRRO / DISTRITO', dest.bairro || ''),
      lv('CEP', dest.cep ? String(dest.cep).replace(/(\d{5})(\d{3})/, '$1-$2') : '', { align: 'center' }),
      lv('DATA DA SAÍDA', dataSaida, { align: 'center' }),
    ]]),
    tbl([munW, ufDW, fonW, ieDW, hrW], [[
      lv('MUNICÍPIO', dest.municipio || ''),
      lv('UF', dest.uf || '', { align: 'center' }),
      lv('FONE / FAX', dest.telefone || ''),
      lv('INSCRIÇÃO ESTADUAL', dest.ie || dest.inscricao_estadual || ''),
      lv('HORA DA SAÍDA', horaSaida, { align: 'center' }),
    ]]),
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 6. CÁLCULO DO IMPOSTO
  // ══════════════════════════════════════════════════════════════════════════
  const impW  = Math.round(PW / 6);
  const impWs = [impW, impW, impW, impW, impW, PW - 5 * impW];

  const impostos = [
    sh('CÁLCULO DO IMPOSTO'),
    tbl(impWs, [[
      lv('BASE DE CÁLCULO DO ICMS',  bcICMS,              { align: 'right' }),
      lv('VALOR DO ICMS',            vlICMS,              { align: 'right' }),
      lv('BASE DE CÁLC. ICMS S.T.',  bcST,                { align: 'right' }),
      lv('VALOR DO ICMS SUBST.',     vlST,                { align: 'right' }),
      lv('VALOR IMP. IMPORTAÇÃO',    '0,00',              { align: 'right' }),
      lv('VALOR TOTAL DOS PRODUTOS', fmt2(totalProdutos), { align: 'right' }),
    ]]),
    tbl(impWs, [[
      lv('VALOR DO FRETE',      vlFrt,           { align: 'right' }),
      lv('VALOR DO SEGURO',     vlSeg,           { align: 'right' }),
      lv('DESCONTO',            vlDesc,          { align: 'right' }),
      lv('OUTRAS DESPESAS',     vlDesp,          { align: 'right' }),
      lv('VALOR TOTAL DO IPI',  vlIPI,           { align: 'right' }),
      lv('VALOR TOTAL DA NOTA', fmt2(totalNota), { align: 'right', size: 9 }),
    ]]),
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 7. TRANSPORTADOR / VOLUMES TRANSPORTADOS
  // ══════════════════════════════════════════════════════════════════════════
  const trTransp = nota.venda?.transporte || {};
  const volQtd   = trTransp.volumes?.quantidade || 0;
  const pBruto   = parseFloat(trTransp.peso_bruto   || 0).toFixed(3).replace('.', ',');
  const pLiq     = parseFloat(trTransp.peso_liquido || 0).toFixed(3).replace('.', ',');

  const [trNomW, trFrtW, trAnttW, trPlacW] = W(0.38, 0.18, 0.15, 0.11);
  const trUf1W  = 30;
  const trCnpjW = PW - trNomW - trFrtW - trAnttW - trPlacW - trUf1W;

  const [trEndW, trMunW] = W(0.44, 0.30);
  const trUf2W = 30;
  const trIe2W = PW - trEndW - trMunW - trUf2W;

  const trV  = Math.round(PW / 6);
  const trVs = [trV, trV, trV, trV, trV, PW - 5 * trV];

  const transportador = [
    sh('TRANSPORTADOR / VOLUMES TRANSPORTADOS'),
    tbl([trNomW, trFrtW, trAnttW, trPlacW, trUf1W, trCnpjW], [[
      lv('NOME / RAZÃO SOCIAL', ''),
      lv('FRETE POR CONTA', freteLabel, { align: 'center' }),
      lv('CÓDIGO ANTT', ''),
      lv('PLACA DO VEÍCULO', ''),
      lv('UF', ''),
      lv('CNPJ / CPF', ''),
    ]]),
    tbl([trEndW, trMunW, trUf2W, trIe2W], [[
      lv('ENDEREÇO', ''),
      lv('MUNICÍPIO', ''),
      lv('UF', ''),
      lv('INSCRIÇÃO ESTADUAL', ''),
    ]]),
    tbl(trVs, [[
      lv('QUANTIDADE',  String(volQtd)),
      lv('ESPÉCIE',     trTransp.volumes?.especie   || ''),
      lv('MARCA',       trTransp.volumes?.marca     || ''),
      lv('NUMERAÇÃO',   trTransp.volumes?.numeracao || ''),
      lv('PESO BRUTO',  pBruto, { align: 'right' }),
      lv('PESO LÍQUIDO', pLiq,  { align: 'right' }),
    ]]),
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 8. DADOS DOS PRODUTOS / SERVIÇOS
  // ══════════════════════════════════════════════════════════════════════════
  const cols = [
    { h: 'CÓDIGO\nPRODUTO',                w: 32,  a: 'center' },
    { h: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', w: 0,   a: 'left'   },
    { h: 'NCM/SH',                         w: 46,  a: 'center' },
    { h: 'O/CST',                          w: 26,  a: 'center' },
    { h: 'CFOP',                           w: 26,  a: 'center' },
    { h: 'UN',                             w: 18,  a: 'center' },
    { h: 'QUANT.',                         w: 40,  a: 'right'  },
    { h: 'VALOR\nUNIT.',                   w: 44,  a: 'right'  },
    { h: 'VALOR\nTOTAL',                   w: 44,  a: 'right'  },
    { h: 'B.CÁLC\nICMS',                   w: 36,  a: 'right'  },
    { h: 'VALOR\nICMS',                    w: 36,  a: 'right'  },
    { h: 'VALOR\nIPI',                     w: 34,  a: 'right'  },
    { h: 'ALÍQ.\nICMS',                    w: 28,  a: 'right'  },
    { h: 'ALÍQ.\nIPI',                     w: 28,  a: 'right'  },
  ];
  const fixedW = cols.reduce((s, c) => s + c.w, 0);
  cols[1].w = PW - fixedW;
  const colWidths = cols.map(c => c.w);

  const headerRow = cols.map(c => ({
    text: c.h, fontSize: 4.5, bold: true, color: CINZA, alignment: 'center',
  }));

  const MIN_ROWS = 15;
  const productRows = itens.map(item => {
    const vals = [
      item.produto?.codigo || item.codigo || '',
      item.descricao || item.produto?.nome || '',
      item.ncm || item.produto?.ncm || '',
      fmtOCST(item),
      item.cfop || '',
      item.produto?.unidade_medida || item.unidade || 'UN',
      fmtQtd(item.quantidade || 1),
      fmt2(item.valor_unitario || 0),
      fmt2(item.valor_total    || 0),
      fmt2(item.bcalc_icms     || 0),
      fmt2(item.valor_icms     || 0),
      fmt2(item.valor_ipi      || 0),
      item.aliq_icms != null ? fmt2(item.aliq_icms) : '',
      item.aliq_ipi  != null ? fmt2(item.aliq_ipi)  : '',
    ];
    return vals.map((v, i) => ({ text: v, fontSize: 6, alignment: cols[i].a }));
  });

  for (let i = itens.length; i < MIN_ROWS; i++) {
    productRows.push(cols.map(() => ({ text: '', fontSize: 6 })));
  }

  const produtos = [
    sh('DADOS DOS PRODUTOS / SERVIÇOS'),
    tbl(colWidths, [headerRow, ...productRows]),
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 9. DADOS ADICIONAIS
  // ══════════════════════════════════════════════════════════════════════════
  const infoW  = Math.round(PW * 0.68);
  const fiscoW = PW - infoW;

  const dadosAdicionais = [
    sh('DADOS ADICIONAIS'),
    {
      table: {
        widths: [infoW, fiscoW],
        heights: [80],
        body: [[
          {
            stack: [
              { text: 'INFORMAÇÕES COMPLEMENTARES', fontSize: 5, color: CINZA, bold: true },
              { text: obsCompl, fontSize: 6.5, margin: [0, 2, 0, 0] },
            ],
            margin: [2, 2, 2, 2],
          },
          {
            stack: [
              { text: 'RESERVADO AO FISCO', fontSize: 5, color: CINZA, bold: true },
            ],
            margin: [2, 2, 2, 2],
          },
        ]],
      },
      layout: thin,
      margin: [0, 0, 0, 0],
    },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 10. RODAPÉ
  // ══════════════════════════════════════════════════════════════════════════
  const dataHora = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Porto_Velho',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).replace(',', '');
  const sistemaLabel = process.env.SISTEMA_NOME || 'Sistema ERP Gráfica Expressa';

  const rodape = {
    text: `${dataHora}   ${sistemaLabel}`,
    fontSize: 6, color: CINZA, margin: [0, 3, 0, 0],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DOCUMENT DEFINITION
  // ══════════════════════════════════════════════════════════════════════════
  const docDef = {
    pageSize: 'A4',
    pageMargins: [14, 14, 14, 14],
    defaultStyle: { fontSize: 7 },
    watermark: tpAmb === '2' ? {
      text: 'SEM VALOR FISCAL', color: '#cccccc', opacity: 0.25, bold: true, angle: -45,
    } : undefined,
    content: [
      canhoto,
      cabecalho,
      natProt,
      ieRow,
      ...destinatario,
      ...impostos,
      ...transportador,
      ...produtos,
      ...dadosAdicionais,
      rodape,
    ],
  };

  // ── Renderiza e retorna Buffer ─────────────────────────────────────────────
  const pdfDoc = await pdfMake.createPdf(docDef).pdfDocumentPromise;
  const chunks = [];
  pdfDoc.on('data', chunk => chunks.push(chunk));
  await new Promise((resolve, reject) => {
    pdfDoc.on('end', resolve);
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
  return Buffer.concat(chunks);
}
