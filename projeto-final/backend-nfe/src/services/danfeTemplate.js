// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt2(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtQtd(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function fmtDoc(d) {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return d || '';
}
function fmtOCST(item) {
  const orig = String(item.origem ?? item.orig ?? '0');
  const cst  = String(item.cst ?? '');
  if (cst.length === 4) return cst;
  if (cst.length >= 2) return `${orig}${cst}`.substring(0, 4);
  return `${orig}102`;
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Template principal ───────────────────────────────────────────────────────
/**
 * @param {Object} dados
 *   emit, dest, nota, itens, chave, chaveFormatada,
 *   barcode64, logo64, numero, serie, numeroFmt,
 *   protocoloDisplay, dataEmissao, dataSaida, horaSaida,
 *   natOp, freteLabel, obsCompl, totalProdutos, totalNota, tpAmb
 */
export function gerarHtmlDanfe(dados) {
  const {
    emit, dest, nota, itens,
    chaveFormatada, barcode64, logo64,
    numeroFmt, serie,
    protocoloDisplay, dataEmissao, dataSaida, horaSaida,
    natOp, freteLabel, obsCompl,
    totalProdutos, totalNota, tpAmb,
  } = dados;

  const isHomolog = tpAmb === '2';

  // ── Linhas de produtos ─────────────────────────────────────────────────────
  const prodRows = itens.map(it => `
    <tr>
      <td class="c">${esc(it.codigo)}</td>
      <td>${esc(it.descricao)}</td>
      <td class="c">${esc(it.ncm)}</td>
      <td class="c">${esc(fmtOCST(it))}</td>
      <td class="c">${esc(it.cfop)}</td>
      <td class="c">${esc(it.unidade)}</td>
      <td class="r">${fmtQtd(it.quantidade)}</td>
      <td class="r">${fmt2(it.valor_unitario)}</td>
      <td class="r">${fmt2(it.valor_total)}</td>
      <td class="r">${it.bc_icms    ? fmt2(it.bc_icms)    : ''}</td>
      <td class="r">${it.aliq_icms  ? fmt2(it.aliq_icms)  : ''}</td>
      <td class="r">${it.valor_icms ? fmt2(it.valor_icms) : ''}</td>
      <td class="r">${it.valor_ipi  ? fmt2(it.valor_ipi)  : ''}</td>
    </tr>
  `).join('');

  const endDest = [
    dest.logradouro,
    dest.numero   ? `, ${dest.numero}` : '',
    dest.complemento ? ` - ${dest.complemento}` : '',
  ].filter(Boolean).join('');

  const canhotoTxt = [
    `RECEBEMOS DE <strong>${esc(emit.razao)}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL`,
    `ELETRÔNICA INDICADA ABAIXO. EMISSÃO: ${dataEmissao} &nbsp; VALOR TOTAL: R$ ${fmt2(totalNota)}`,
    `DEST.: ${esc(dest.nome)}`,
    dest.logradouro ? ` - ${esc(endDest)}` : '',
    dest.bairro    ? ` - ${esc(dest.bairro)}`    : '',
    dest.municipio ? ` - ${esc(dest.municipio)}` : '',
    dest.uf        ? `/${esc(dest.uf)}`           : '',
  ].join('');

  return /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DANFE NF-e ${numeroFmt}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7pt;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Página ── */
  .pg { width: 210mm; min-height: 297mm; padding: 6mm 6mm 6mm 6mm; }

  /* ── Linhas e células ── */
  .row { display: flex; width: 100%; }
  .cell {
    border: 0.4pt solid #000;
    padding: 0.8mm 1.2mm 0.5mm 1.2mm;
    min-height: 10.5mm;
    position: relative;
    overflow: hidden;
  }
  .cell + .cell { margin-left: -0.4pt; }
  .row + .row   { margin-top: -0.4pt; }

  /* ── Labels e valores ── */
  .lbl {
    display: block;
    font-size: 5.2pt;
    font-weight: bold;
    color: #444;
    text-transform: uppercase;
    line-height: 1.2;
    margin-bottom: 0.8mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .val {
    display: block;
    font-size: 7.5pt;
    font-weight: bold;
    line-height: 1.2;
  }
  .val-sm { font-size: 6.5pt; font-weight: bold; display: block; }
  .val-xs { font-size: 5.5pt; font-weight: bold; display: block; }
  .r { text-align: right; }
  .c { text-align: center; }

  /* ── Section headers ── */
  .sh {
    background: #d5d5d5;
    border: 0.4pt solid #000;
    padding: 0.5mm 1.2mm;
    font-size: 5.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.2pt;
    width: 100%;
    margin-top: -0.4pt;
  }

  /* ── Canhoto ── */
  .canhoto {
    border: 0.4pt solid #000;
    border-bottom: 0.8pt dashed #555;
    padding: 2mm;
    margin-bottom: 1mm;
  }
  .canhoto-inner { display: flex; align-items: stretch; }
  .canhoto-txt { flex: 1; font-size: 5.5pt; line-height: 1.5; padding-right: 2mm; }
  .canhoto-data {
    border-left: 0.4pt solid #000;
    padding-left: 2mm;
    flex: 0 0 44mm;
  }
  .canhoto-nf {
    border-left: 0.4pt solid #000;
    padding-left: 2mm;
    flex: 0 0 26mm;
    text-align: center;
  }
  .canhoto-line { border-bottom: 0.4pt solid #000; height: 5mm; margin: 1mm 0; }

  /* ── Cabeçalho ── */
  .hdr-emit  { flex: 0 0 50%; }
  .hdr-danfe { flex: 0 0 20%; text-align: center; }
  .hdr-chave { flex: 0 0 30%; }

  /* Caixa 0/1 entrada/saída */
  .es-box {
    border: 1.5pt solid #000;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 8mm;
    height: 5.5mm;
    font-size: 9pt;
    font-weight: bold;
    vertical-align: middle;
    margin-left: 1mm;
  }

  /* ── Tabela de produtos ── */
  .pt { width: 100%; border-collapse: collapse; font-size: 5.5pt; }
  .pt th {
    background: #ebebeb;
    border: 0.3pt solid #000;
    padding: 0.4mm 0.5mm;
    font-size: 5pt;
    font-weight: bold;
    text-align: center;
    vertical-align: bottom;
    line-height: 1.2;
  }
  .pt td {
    border: 0.3pt solid #000;
    padding: 0.6mm 0.7mm;
    vertical-align: middle;
    line-height: 1.3;
  }
  .pt .desc { text-align: left; font-size: 6pt; }

  /* ── Homologação ── */
  ${isHomolog ? `
  .homolog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 52pt;
    font-weight: bold;
    color: rgba(200, 0, 0, 0.09);
    white-space: nowrap;
    pointer-events: none;
    z-index: 9999;
    letter-spacing: 2pt;
  }` : ''}
</style>
</head>
<body>
<div class="pg">
${isHomolog ? '<div class="homolog">SEM VALOR FISCAL</div>' : ''}

<!-- ══════════════════ CANHOTO ══════════════════ -->
<div class="canhoto">
  <div class="canhoto-inner">
    <div class="canhoto-txt">${canhotoTxt}</div>
    <div class="canhoto-data">
      <div class="lbl">DATA DE RECEBIMENTO</div>
      <div class="canhoto-line"></div>
      <div class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
    </div>
    <div class="canhoto-nf">
      <div style="font-size:12pt;font-weight:bold;margin-top:1mm;">NF-e</div>
      <div style="font-size:7pt;font-weight:bold;margin-top:0.5mm;">Nº. ${esc(numeroFmt)}</div>
      <div style="font-size:6pt;margin-top:0.5mm;">Série ${esc(serie)}</div>
    </div>
  </div>
</div>

<!-- ══════════════════ CABEÇALHO ══════════════════ -->
<div class="row">

  <!-- EMITENTE -->
  <div class="cell hdr-emit" style="min-height:38mm;">
    <div style="font-size:5pt;color:#555;font-style:italic;text-align:center;margin-bottom:1mm;">
      IDENTIFICAÇÃO DO EMITENTE
    </div>
    ${logo64
      ? `<img src="data:image/png;base64,${logo64}" style="display:block;margin:0 auto 1.5mm auto;max-height:12mm;max-width:54mm;">`
      : ''}
    <div style="font-size:8.5pt;font-weight:bold;text-align:center;line-height:1.2;margin-bottom:1mm;">
      ${esc(emit.razao)}
    </div>
    ${emit.fantasia ? `<div style="font-size:7pt;text-align:center;margin-bottom:0.5mm;">${esc(emit.fantasia)}</div>` : ''}
    <div style="font-size:6.5pt;text-align:center;line-height:1.5;">
      ${esc(emit.logradouro)}${emit.numero ? `, ${esc(emit.numero)}` : ''}<br>
      ${esc(emit.bairro)}${emit.cep ? ` - ${esc(emit.cep)}` : ''}<br>
      ${esc(emit.municipio)}${emit.uf ? ` - ${esc(emit.uf)}` : ''}${emit.telefone ? `  Fone/Fax: ${esc(emit.telefone)}` : ''}
    </div>
  </div>

  <!-- DANFE TITLE -->
  <div class="cell hdr-danfe" style="min-height:38mm;padding:1.5mm 1mm;">
    <div style="font-size:17pt;font-weight:bold;margin-top:2mm;letter-spacing:1pt;">DANFE</div>
    <div style="font-size:5.5pt;margin-top:1.5mm;line-height:1.4;">
      Documento Auxiliar da<br>Nota Fiscal Eletrônica
    </div>
    <div style="margin-top:2.5mm;text-align:left;padding-left:1mm;">
      <div style="font-size:6.5pt;line-height:1.6;">0 - ENTRADA</div>
      <div style="font-size:6.5pt;display:flex;align-items:center;">
        1 - SAÍDA <span class="es-box">1</span>
      </div>
    </div>
    <div style="font-size:8pt;font-weight:bold;margin-top:2.5mm;">Nº. ${esc(numeroFmt)}</div>
    <div style="font-size:6.5pt;margin-top:0.5mm;">Série ${esc(serie)}</div>
    <div style="font-size:5.5pt;color:#666;margin-top:0.5mm;">Folha 1/1</div>
  </div>

  <!-- CHAVE + BARCODE -->
  <div class="cell hdr-chave" style="min-height:38mm;padding:1.5mm;">
    ${barcode64
      ? `<img src="data:image/png;base64,${barcode64}" style="display:block;width:calc(100% - 2mm);height:12mm;object-fit:fill;margin-bottom:1mm;">`
      : `<div style="height:12mm;border:0.4pt dashed #bbb;margin-bottom:1mm;display:flex;align-items:center;justify-content:center;font-size:6pt;color:#aaa;">CÓDIGO DE BARRAS</div>`}
    <div class="lbl">CHAVE DE ACESSO</div>
    <div style="font-family:'Courier New',Courier,monospace;font-size:5pt;font-weight:bold;letter-spacing:0.3pt;word-break:break-all;line-height:1.5;margin:0.5mm 0;">
      ${esc(chaveFormatada)}
    </div>
    <div style="font-size:5pt;color:#444;line-height:1.5;margin-top:1mm;">
      Consulta de autenticidade no portal nacional da NF-e<br>
      www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora
    </div>
  </div>
</div>

<!-- NATUREZA | PROTOCOLO -->
<div class="row">
  <div class="cell" style="flex:0 0 55%;min-height:10mm;">
    <span class="lbl">NATUREZA DA OPERAÇÃO</span>
    <span class="val">${esc(natOp)}</span>
  </div>
  <div class="cell" style="flex:0 0 45%;min-height:10mm;">
    <span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
    <span class="val-sm" style="color:${nota.protocolo ? '#000' : '#666'};">${esc(protocoloDisplay)}</span>
  </div>
</div>

<!-- IE | IE SUBST | CNPJ EMITENTE -->
<div class="row">
  <div class="cell" style="flex:0 0 25%;min-height:10mm;">
    <span class="lbl">INSCRIÇÃO ESTADUAL</span>
    <span class="val">${esc(emit.ie || '')}</span>
  </div>
  <div class="cell" style="flex:0 0 37%;min-height:10mm;">
    <span class="lbl">INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.</span>
    <span class="val"></span>
  </div>
  <div class="cell" style="flex:0 0 38%;min-height:10mm;">
    <span class="lbl">CNPJ / CPF</span>
    <span class="val">${esc(emit.cnpj || '')}</span>
  </div>
</div>

<!-- ══════════════════ DESTINATÁRIO ══════════════════ -->
<div class="sh">DESTINATÁRIO / REMETENTE</div>

<div class="row">
  <div class="cell" style="flex:0 0 60%;min-height:10mm;">
    <span class="lbl">NOME / RAZÃO SOCIAL</span>
    <span class="val">${esc(dest.nome || '')}</span>
  </div>
  <div class="cell" style="flex:0 0 22%;min-height:10mm;">
    <span class="lbl">CNPJ / CPF</span>
    <span class="val">${esc(fmtDoc(dest.cpf_cnpj))}</span>
  </div>
  <div class="cell r" style="flex:0 0 18%;min-height:10mm;">
    <span class="lbl" style="text-align:right;">DATA DA EMISSÃO</span>
    <span class="val">${esc(dataEmissao)}</span>
  </div>
</div>

<div class="row">
  <div class="cell" style="flex:0 0 47%;min-height:10mm;">
    <span class="lbl">ENDEREÇO</span>
    <span class="val-sm">${esc(endDest)}</span>
  </div>
  <div class="cell" style="flex:0 0 20%;min-height:10mm;">
    <span class="lbl">BAIRRO / DISTRITO</span>
    <span class="val-sm">${esc(dest.bairro || '')}</span>
  </div>
  <div class="cell c" style="flex:0 0 13%;min-height:10mm;">
    <span class="lbl">CEP</span>
    <span class="val-sm">${esc(dest.cep || '')}</span>
  </div>
  <div class="cell c" style="flex:0 0 12%;min-height:10mm;">
    <span class="lbl">DATA SAÍDA/ENTRADA</span>
    <span class="val-sm">${esc(dataSaida || dataEmissao)}</span>
  </div>
  <div class="cell c" style="flex:0 0 8%;min-height:10mm;">
    <span class="lbl">HORA</span>
    <span class="val-sm">${esc(horaSaida)}</span>
  </div>
</div>

<div class="row">
  <div class="cell" style="flex:0 0 44%;min-height:10mm;">
    <span class="lbl">MUNICÍPIO</span>
    <span class="val-sm">${esc(dest.municipio || '')}</span>
  </div>
  <div class="cell c" style="flex:0 0 7%;min-height:10mm;">
    <span class="lbl">UF</span>
    <span class="val-sm">${esc(dest.uf || '')}</span>
  </div>
  <div class="cell" style="flex:0 0 18%;min-height:10mm;">
    <span class="lbl">FONE / FAX</span>
    <span class="val-sm">${esc(dest.telefone || '')}</span>
  </div>
  <div class="cell" style="flex:0 0 18%;min-height:10mm;">
    <span class="lbl">INSCRIÇÃO ESTADUAL</span>
    <span class="val-sm">${esc(dest.inscricao_estadual || 'ISENTO')}</span>
  </div>
  <div class="cell" style="flex:0 0 13%;min-height:10mm;overflow:hidden;">
    <span class="lbl">EMAIL</span>
    <span class="val-xs" style="word-break:break-all;">${esc(dest.email || '')}</span>
  </div>
</div>

<!-- ══════════════════ CÁLCULO DO IMPOSTO ══════════════════ -->
<div class="sh">CÁLCULO DO IMPOSTO</div>

<div class="row">
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">BASE DE CÁLC. DO ICMS</span>
    <span class="val">${fmt2(nota.totais?.bc_icms)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">VALOR DO ICMS</span>
    <span class="val">${fmt2(nota.totais?.valor_icms)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">BASE DE CÁLC. DO ICMS ST</span>
    <span class="val">${fmt2(nota.totais?.bc_icms_st)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">VALOR DO ICMS SUBST.</span>
    <span class="val">${fmt2(nota.totais?.valor_icms_st)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">VALOR TOTAL DOS PRODUTOS</span>
    <span class="val">${fmt2(totalProdutos)}</span>
  </div>
</div>

<div class="row">
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">VALOR DO FRETE</span>
    <span class="val">${fmt2(nota.valor_frete)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">VALOR DO SEGURO</span>
    <span class="val">${fmt2(nota.valor_seguro)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">DESCONTO</span>
    <span class="val">${fmt2(nota.desconto)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">OUTRAS DESPESAS ACESS.</span>
    <span class="val">${fmt2(nota.outras_despesas)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">VALOR TOTAL DO IPI</span>
    <span class="val">${fmt2(nota.totais?.valor_ipi)}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;background:#f0f0f0;">
    <span class="lbl">VALOR TOTAL DA NOTA</span>
    <span class="val" style="font-size:9pt;">${fmt2(totalNota)}</span>
  </div>
</div>

<!-- ══════════════════ TRANSPORTADOR ══════════════════ -->
<div class="sh">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>

<div class="row">
  <div class="cell" style="flex:0 0 40%;min-height:10mm;">
    <span class="lbl">RAZÃO SOCIAL</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell" style="flex:0 0 17%;min-height:10mm;">
    <span class="lbl">FRETE POR CONTA</span>
    <span class="val-sm">${esc(freteLabel)}</span>
  </div>
  <div class="cell" style="flex:0 0 12%;min-height:10mm;">
    <span class="lbl">CÓDIGO ANTT</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell" style="flex:0 0 12%;min-height:10mm;">
    <span class="lbl">PLACA DO VEÍCULO</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell c" style="flex:0 0 5%;min-height:10mm;">
    <span class="lbl">UF</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell" style="flex:0 0 14%;min-height:10mm;">
    <span class="lbl">CNPJ / CPF</span>
    <span class="val-sm"></span>
  </div>
</div>

<div class="row">
  <div class="cell" style="flex:0 0 40%;min-height:10mm;">
    <span class="lbl">ENDEREÇO</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell" style="flex:0 0 30%;min-height:10mm;">
    <span class="lbl">MUNICÍPIO</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell c" style="flex:0 0 5%;min-height:10mm;">
    <span class="lbl">UF</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell" style="flex:0 0 25%;min-height:10mm;">
    <span class="lbl">INSCRIÇÃO ESTADUAL</span>
    <span class="val-sm"></span>
  </div>
</div>

<div class="row">
  <div class="cell c" style="flex:1;min-height:10mm;">
    <span class="lbl">QUANTIDADE</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell c" style="flex:1;min-height:10mm;">
    <span class="lbl">ESPÉCIE</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell c" style="flex:1;min-height:10mm;">
    <span class="lbl">MARCA</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell c" style="flex:2;min-height:10mm;">
    <span class="lbl">NUMERAÇÃO</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">PESO BRUTO</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell r" style="flex:1;min-height:10mm;">
    <span class="lbl">PESO LÍQUIDO</span>
    <span class="val-sm"></span>
  </div>
</div>

<!-- ══════════════════ PRODUTOS ══════════════════ -->
<div class="sh">DADOS DOS PRODUTOS / SERVIÇOS</div>
<table class="pt" style="margin-top:-0.4pt;">
  <thead>
    <tr>
      <th style="width:8%">CÓD.<br>PRODUTO</th>
      <th style="width:26%">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
      <th style="width:7%">NCM/<br>SH</th>
      <th style="width:5%">O<br>CST</th>
      <th style="width:5%">CFOP</th>
      <th style="width:4%">UN.</th>
      <th style="width:6%">QTDE.</th>
      <th style="width:7%">VL.<br>UNIT.</th>
      <th style="width:7%">VL.<br>TOTAL</th>
      <th style="width:7%">B.CALC.<br>ICMS</th>
      <th style="width:5%">ALQ.<br>ICMS</th>
      <th style="width:6%">VL.<br>ICMS</th>
      <th style="width:7%">VL.<br>IPI</th>
    </tr>
  </thead>
  <tbody>
    ${prodRows}
  </tbody>
</table>

<!-- ══════════════════ ISSQN (vazio) ══════════════════ -->
<div class="sh" style="margin-top:0.5mm;">CÁLCULO DO ISSQN</div>
<div class="row">
  <div class="cell r" style="flex:1;min-height:9mm;">
    <span class="lbl">INSCRIÇÃO MUNICIPAL</span>
    <span class="val-sm">${esc(emit.im || '')}</span>
  </div>
  <div class="cell r" style="flex:1;min-height:9mm;">
    <span class="lbl">VALOR TOTAL DOS SERVIÇOS</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell r" style="flex:1;min-height:9mm;">
    <span class="lbl">BASE DE CÁLCULO DO ISSQN</span>
    <span class="val-sm"></span>
  </div>
  <div class="cell r" style="flex:1;min-height:9mm;">
    <span class="lbl">VALOR DO ISSQN</span>
    <span class="val-sm"></span>
  </div>
</div>

<!-- ══════════════════ DADOS ADICIONAIS ══════════════════ -->
<div class="sh" style="margin-top:0.5mm;">DADOS ADICIONAIS</div>
<div class="row">
  <div class="cell" style="flex:0 0 70%;min-height:30mm;padding:1.5mm;">
    <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
    <div style="font-size:6.5pt;white-space:pre-line;line-height:1.5;margin-top:0.5mm;">${esc(obsCompl || '')}</div>
  </div>
  <div class="cell" style="flex:0 0 30%;min-height:30mm;padding:1.5mm;">
    <span class="lbl">RESERVADO AO FISCO</span>
  </div>
</div>

</div>
</body>
</html>`;
}
