import { create } from 'xmlbuilder2';

// ── Cálculo do DV da chave de acesso — Módulo 11 SEFAZ ─────────────────────
// Algoritmo: percorre da DIREITA para a ESQUERDA com pesos ciclando de 2 a 9
// Conforme Manual de Integração NF-e v6.00, Seção 5 (Chave de Acesso)
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

// Gera cNF com exatamente 8 dígitos aleatórios
function gerarCNF() {
  return String(Math.floor(10000000 + Math.random() * 89999999));
}

export function gerarChaveAcesso({ cUF, aamm, cnpj, serie, nNF, cNF }) {
  const cnpjLimpo = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  const seriePad  = String(serie).padStart(3, '0');
  const nNFPad    = String(nNF).padStart(9, '0');
  const cNFPad    = String(cNF).padStart(8, '0');
  // Posições: cUF(2) + aamm(4) + cnpj(14) + mod(2=55) + serie(3) + nNF(9) + tpEmis(1=1) + cNF(8) = 43 dígitos
  const chave43   = `${cUF}${aamm}${cnpjLimpo}55${seriePad}${nNFPad}1${cNFPad}`;
  if (chave43.length !== 43) {
    throw new Error(`Chave43 inválida: ${chave43.length} dígitos (esperado 43). Valor: ${chave43}`);
  }
  const cDV = calcDV(chave43);
  return { chave: chave43 + cDV, cNF: cNFPad, cDV: String(cDV) };
}

function fmt2(n)  { return parseFloat(n || 0).toFixed(2); }
function fmt4(n)  { return parseFloat(n || 0).toFixed(4); }
function fmt10(n) { return parseFloat(n || 0).toFixed(10); }

export function buildNFeXml({ numero, serie = 1, naturezaOperacao = 'Venda de producao do estabelecimento', destinatario, itens, formaPagamento = '01', observacoes = '', transporte = {}, desconto = 0, valorIcms = 0, valorBcIcms = 0, valorFrete = 0, valorSeguro = 0, valorDespesas = 0, valorTotTrib = 0, finNFe = '1', tpNF = '1' }) {
  // tpAmb obrigatoriamente via variável de ambiente
  const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';
  const cUF   = String(process.env.SEFAZ_CODIGO_UF || '11');
  const cnpj  = (process.env.EMPRESA_CNPJ || '').replace(/\D/g, '');

  // Rondônia usa UTC-4 (não observa horário de verão — sem DST)
  // Offset fixo: -04:00
  const OFFSET_HORAS = -4;
  const OFFSET_STR   = '-04:00';
  const now          = new Date();
  // Calcula hora local RO
  const localNow     = new Date(now.getTime() + OFFSET_HORAS * 3600 * 1000);
  const aamm = `${String(localNow.getUTCFullYear()).slice(2)}${String(localNow.getUTCMonth() + 1).padStart(2, '0')}`;
  // dhEmi no formato ISO 8601 com timezone -04:00
  const dhEmi = localNow.toISOString().replace(/\.\d+Z$/, OFFSET_STR);

  const cNF = gerarCNF();
  const { chave, cDV } = gerarChaveAcesso({ cUF, aamm, cnpj, serie, nNF: numero, cNF });

  // idDest: 1=interna, 2=interestadual, 3=exterior — determinado pelo CFOP do primeiro item
  const primeiroCfop = String((itens && itens[0]?.cfop) || '5101');
  const idDest = primeiroCfop.startsWith('7') ? '3' : primeiroCfop.startsWith('6') ? '2' : '1';

  console.log(`[XML] chave=${chave} (44 dígitos: ${chave.length === 44 ? 'OK' : 'ERRO'})`);
  console.log(`[XML] tpAmb=${tpAmb} dhEmi=${dhEmi} cDV=${cDV}`);

  // Totais
  const vProd  = itens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
  const vDesc  = parseFloat(desconto)     || 0;
  const vFrete = parseFloat(valorFrete)   || 0;
  const vSeg   = parseFloat(valorSeguro)  || 0;
  const vOutro = parseFloat(valorDespesas)|| 0;
  const vICMS  = parseFloat(valorIcms)    || 0;
  const vBC    = parseFloat(valorBcIcms)  || 0;
  const vTTrib = parseFloat(valorTotTrib) || 0;
  const vNF    = Math.max(0, vProd + vFrete + vSeg + vOutro - vDesc);

  // Distribui desconto proporcional por item (SEFAZ 537: soma vDesc itens = ICMSTot.vDesc)
  const descontosCents = itens.map(item => {
    if (vDesc === 0 || vProd === 0) return 0;
    return Math.round((parseFloat(item.valor_total || 0) / vProd) * vDesc * 100);
  });
  // Corrige diferença de arredondamento no último item
  const totalDescCents = descontosCents.reduce((a, b) => a + b, 0);
  const diffCents = Math.round(vDesc * 100) - totalDescCents;
  if (descontosCents.length > 0) descontosCents[descontosCents.length - 1] += diffCents;

  // Montagem dos itens
  const detList = itens.map((item, idx) => {
    const vProdItem    = fmt2(item.valor_total);
    const qCom         = fmt4(item.quantidade || 1);
    const vUnCom       = fmt10(item.valor_unitario || item.valor_total);
    const vDescItem    = (descontosCents[idx] / 100).toFixed(2);
    const hasDescItem  = descontosCents[idx] > 0;
    // vTotTrib por item: proporcional ao valor total do item em relação ao total da nota
    const vItemTrib = vTTrib > 0 && vProd > 0
      ? vTTrib * (parseFloat(item.valor_total || 0) / vProd)
      : 0;
    return {
      '@nItem': String(idx + 1),
      prod: {
        cProd:    item.codigo || String(idx + 1).padStart(3, '0'),
        cEAN:     'SEM GTIN',
        xProd:    (item.descricao || item.nome || 'Produto').replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').trim().substring(0, 120) || 'Produto',
        NCM:      item.ncm || '49111090',
        CFOP:     item.cfop || '5101',
        uCom:     item.unidade || 'UN',
        qCom,
        vUnCom,
        vProd:    vProdItem,
        cEANTrib: 'SEM GTIN',
        uTrib:    item.unidade || 'UN',
        qTrib:    qCom,
        vUnTrib:  fmt10(item.valor_unitario || item.valor_total),
        ...(hasDescItem ? { vDesc: vDescItem } : {}),
        indTot:   '1',
      },
      imposto: {
        ...(vItemTrib > 0 ? { vTotTrib: fmt2(vItemTrib) } : {}),
        ICMS: {
          ICMSSN102: {   // Simples Nacional - tributada sem crédito (CSOSN 102)
            orig:  '0',
            CSOSN: '102',
          },
        },
        PIS: {
          PISNT: { CST: '07' },   // Isenta
        },
        COFINS: {
          COFINSNT: { CST: '07' }, // Isenta
        },
      },
    };
  });

  // Destinatário: CPF ou CNPJ
  const docDest = String(destinatario.cpf_cnpj || '').replace(/\D/g, '');
  const destNode = docDest.length === 11
    ? { CPF: docDest }
    : { CNPJ: docDest || '00000000000000' };

  // Em homologação o xNome do destinatário DEVE ser este texto fixo (obrigatório SEFAZ)
  const xNomeDest = tpAmb === '2'
    ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
    : (destinatario.nome || '');

  const nfeObj = {
    NFe: {
      '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
      infNFe: {
        '@versao': '4.00',
        '@Id': `NFe${chave}`,
        ide: {
          cUF,
          cNF: String(cNF).padStart(8, '0'),
          natOp:    naturezaOperacao,
          mod:      '55',
          serie:    String(serie),
          nNF:      String(numero),
          dhEmi,
          dhSaiEnt: dhEmi,
          tpNF:     tpNF,       // 0=entrada, 1=saída
          idDest,              // 1=interna, 2=interestadual, 3=exterior (auto pelo CFOP)
          cMunFG:   process.env.EMPRESA_CODIGO_MUNICIPIO || '1101708',
          tpImp:    '1',       // DANFE retrato
          tpEmis:   '1',       // emissão normal
          cDV,
          tpAmb,
          finNFe:   finNFe,    // 1=normal, 2=complementar, 3=ajuste, 4=devolução
          indFinal: '1',       // consumidor final
          indPres:  '1',       // presencial
          procEmi:  '0',
          verProc:  '4.00',    // versão do aplicativo emissor (padrão NF-e 4.00)
        },
        emit: {
          CNPJ:  cnpj,
          xNome: process.env.EMPRESA_RAZAO_SOCIAL || '',
          xFant: process.env.EMPRESA_NOME_FANTASIA || '',
          enderEmit: {
            xLgr:    process.env.EMPRESA_LOGRADOURO || '',
            nro:     process.env.EMPRESA_NUMERO || 'SN',
            xBairro: process.env.EMPRESA_BAIRRO || '',
            cMun:    process.env.EMPRESA_CODIGO_MUNICIPIO || '1101708',
            xMun:    process.env.EMPRESA_MUNICIPIO || 'VILHENA',
            UF:      process.env.EMPRESA_UF || 'RO',
            CEP:     (process.env.EMPRESA_CEP || '').replace(/\D/g, ''),
            cPais:   '1058',
            xPais:   'Brasil',
            fone:    (process.env.EMPRESA_TELEFONE || '').replace(/\D/g, ''),
          },
          IE:  (process.env.EMPRESA_IE || '').replace(/\D/g, ''),
          CRT: process.env.EMPRESA_CRT || '1',
        },
        dest: (() => {
          const ieRaw = String(destinatario.ie || '').trim();
          const ieIsento = ieRaw.toUpperCase() === 'ISENTO';
          const ieClean = ieIsento ? 'ISENTO' : ieRaw.replace(/\D/g, '');
          const indIEDest = destinatario.ind_ie
            ? String(destinatario.ind_ie)
            : (ieClean && !ieIsento ? '1' : ieIsento ? '2' : '9');
          const san = v => String(v || '').replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').trim();
          return {
            ...destNode,
            xNome: xNomeDest,
            enderDest: {
              xLgr:    san(destinatario.logradouro) || 'Rua Nao Informada',
              nro:     san(destinatario.numero) || 'SN',
              xBairro: san(destinatario.bairro) || 'Nao Informado',
              cMun:    destinatario.codigo_municipio || '1101708',
              xMun:    san(destinatario.municipio) || 'VILHENA',
              UF:      (destinatario.uf || 'RO').toUpperCase(),
              CEP:     (destinatario.cep || '76982249').replace(/\D/g, ''),
              cPais:   '1058',
              xPais:   'Brasil',
            },
            indIEDest,
            ...(ieClean ? { IE: ieClean } : {}),
          };
        })(),
        det: detList,
        total: {
          ICMSTot: {
            vBC:        fmt2(vBC),
            vICMS:      fmt2(vICMS),
            vICMSDeson: '0.00',
            vFCP:       '0.00',
            vBCST:      '0.00',
            vST:        '0.00',
            vFCPST:     '0.00',
            vFCPSTRet:  '0.00',
            vProd:      fmt2(vProd),
            vFrete:     fmt2(vFrete),
            vSeg:       fmt2(vSeg),
            vDesc:      fmt2(vDesc),
            vII:        '0.00',
            vIPI:       '0.00',
            vIPIDevol:  '0.00',
            vPIS:       '0.00',
            vCOFINS:    '0.00',
            vOutro:     fmt2(vOutro),
            ...(vTTrib > 0 ? { vTotTrib: fmt2(vTTrib) } : {}),
            vNF:        fmt2(vNF),
          },
        },
        transp: (() => {
          const modFrete = String(transporte.modalidade_frete ?? '9');
          const volQtd   = parseInt(transporte.volumes?.quantidade  || 0);
          const pesoBrut = parseFloat(transporte.peso_bruto         || 0);
          const pesoLiq  = parseFloat(transporte.peso_liquido       || 0);
          const especie  = (transporte.volumes?.especie  || '').trim();
          const marca    = (transporte.volumes?.marca    || '').trim();
          const numeracao= (transporte.volumes?.numeracao|| '').trim();
          const fmt3     = v => parseFloat(v || 0).toFixed(3);
          const t = { modFrete };
          if (volQtd > 0 || pesoBrut > 0 || pesoLiq > 0) {
            t.vol = {
              qVol:  String(volQtd),
              ...(especie   ? { esp:   especie }   : {}),
              ...(marca     ? { marca: marca }     : {}),
              ...(numeracao ? { nVol:  numeracao } : {}),
              pesoL: fmt3(pesoLiq),
              pesoB: fmt3(pesoBrut),
            };
          }
          return t;
        })(),
        pag: {
          detPag: {
            tPag: formaPagamento,
            vPag: fmt2(vNF),
          },
        },
        infAdic: {
          infCpl: (() => {
            const cnpjFmt = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            const defaultCpl = `EMPRESA OPTANTE PELO SIMPLES NACIONAL; DADOS BANCARIOS: SICOOB AG: 3325 C/C 4.231-5; GRAFICA E EDITORA EXPRESS LTDA ME; OU PIX: CNPJ ${cnpjFmt}`;
            if (!observacoes) return defaultCpl;
            return observacoes.replace(/\r/g, '').replace(/\n+/g, '; ').replace(/\s{2,}/g, ' ').trim().slice(0, 5000);
          })(),
        },
      },
    },
  };

  const xmlStr = create(nfeObj).end({ prettyPrint: false });
  return { xmlStr, chave, numero };
}
