import { create } from 'xmlbuilder2';

// Calcula dígito verificador da chave de acesso (módulo 11)
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

function gerarCNF() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function gerarChaveAcesso({ cUF, aamm, cnpj, serie, nNF, cNF }) {
  const cnpjLimpo = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  const seriePad  = String(serie).padStart(3, '0');
  const nNFPad    = String(nNF).padStart(9, '0');
  const cNFPad    = String(cNF).padStart(8, '0');
  const chave43   = `${cUF}${aamm}${cnpjLimpo}55${seriePad}${nNFPad}1${cNFPad}`;
  const cDV       = calcDV(chave43);
  return { chave: chave43 + cDV, cNF: cNFPad, cDV: String(cDV) };
}

function fmt2(n) { return parseFloat(n || 0).toFixed(2); }
function fmt4(n) { return parseFloat(n || 0).toFixed(4); }

export function buildNFeXml({ numero, serie = 1, naturezaOperacao = 'Venda de produção do estabelecimento', destinatario, itens, formaPagamento = '01' }) {
  const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';
  const cUF   = String(process.env.SEFAZ_CODIGO_UF || '11');
  const cnpj  = (process.env.EMPRESA_CNPJ || '').replace(/\D/g, '');

  // Rondônia = UTC-4 (não observa horário de verão)
  const OFFSET_RO = -4;
  const now       = new Date();
  const localNow  = new Date(now.getTime() + OFFSET_RO * 3600 * 1000);
  const aamm  = `${String(localNow.getUTCFullYear()).slice(2)}${String(localNow.getUTCMonth() + 1).padStart(2, '0')}`;
  const dhEmi = localNow.toISOString().replace(/\.\d+Z$/, '-04:00');

  const cNF           = gerarCNF();
  const { chave, cDV } = gerarChaveAcesso({ cUF, aamm, cnpj, serie, nNF: numero, cNF });

  // Totais
  const vProd = itens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
  const vNF   = vProd;

  // Montagem dos itens
  const detList = itens.map((item, idx) => {
    const vProdItem = fmt2(item.valor_total);
    const qCom      = fmt4(item.quantidade || 1);
    const vUnCom    = fmt2(item.valor_unitario || item.valor_total);
    return {
      '@nItem': String(idx + 1),
      prod: {
        cProd:    item.codigo || String(idx + 1).padStart(3, '0'),
        cEAN:     'SEM GTIN',
        xProd:    item.descricao || item.nome || 'Produto',
        NCM:      item.ncm || '49111090',
        CFOP:     item.cfop || '5101',
        uCom:     item.unidade || 'UN',
        qCom,
        vUnCom,
        vProd:    vProdItem,
        cEANTrib: 'SEM GTIN',
        uTrib:    item.unidade || 'UN',
        qTrib:    qCom,
        vUnTrib:  vUnCom,
        indTot:   '1',
      },
      imposto: {
        ICMS: {
          ICMSSN102: {   // Simples Nacional - tributada sem crédito (CFOP 5101)
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
    : { CNPJ: docDest };

  const nfeObj = {
    NFe: {
      '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
      infNFe: {
        '@versao': '4.00',
        '@Id': `NFe${chave}`,
        ide: {
          cUF,
          cNF: String(cNF).padStart(8, '0'),
          natOp:   naturezaOperacao,
          mod:     '55',
          serie:   String(serie),
          nNF:     String(numero),
          dhEmi,
          dhSaiEnt: dhEmi,
          tpNF:    '1',       // saída
          idDest:  '1',       // interna
          cMunFG:  process.env.EMPRESA_CODIGO_MUNICIPIO || '1101708',
          tpImp:   '1',       // DANFE retrato
          tpEmis:  '1',       // emissão normal
          cDV,
          tpAmb,
          finNFe:  '1',       // normal
          indFinal:'1',       // consumidor final
          indPres: '1',       // presencial
          procEmi: '0',
          verProc: '1.0.0',
        },
        emit: {
          CNPJ:  cnpj,
          xNome: process.env.EMPRESA_RAZAO_SOCIAL || '',
          xFant: process.env.EMPRESA_NOME_FANTASIA || '',
          enderEmit: {
            xLgr:   process.env.EMPRESA_LOGRADOURO || '',
            nro:    process.env.EMPRESA_NUMERO || 'SN',
            xBairro:process.env.EMPRESA_BAIRRO || '',
            cMun:   process.env.EMPRESA_CODIGO_MUNICIPIO || '1101708',
            xMun:   process.env.EMPRESA_MUNICIPIO || 'VILHENA',
            UF:     process.env.EMPRESA_UF || 'RO',
            CEP:    (process.env.EMPRESA_CEP || '').replace(/\D/g, ''),
            cPais:  '1058',
            xPais:  'Brasil',
            fone:   (process.env.EMPRESA_TELEFONE || '').replace(/\D/g, ''),
          },
          IE:  (process.env.EMPRESA_IE || '').replace(/\D/g, ''),
          CRT: process.env.EMPRESA_CRT || '1',
        },
        dest: {
          ...destNode,
          xNome:    tpAmb === '2'
            ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
            : (destinatario.nome || ''),
          enderDest: {
            xLgr:    destinatario.logradouro || 'Rua Não Informada',
            nro:     destinatario.numero || 'SN',
            xBairro: destinatario.bairro || 'Não Informado',
            cMun:    destinatario.codigo_municipio || '1101708',
            xMun:    destinatario.municipio || 'VILHENA',
            UF:      destinatario.uf || 'RO',
            CEP:     (destinatario.cep || '76982249').replace(/\D/g, ''),
            cPais:   '1058',
            xPais:   'Brasil',
          },
          indIEDest: '9',   // não contribuinte
        },
        det: detList,
        total: {
          ICMSTot: {
            vBC:       '0.00',
            vICMS:     '0.00',
            vICMSDeson:'0.00',
            vFCP:      '0.00',
            vBCST:     '0.00',
            vST:       '0.00',
            vFCPST:    '0.00',
            vFCPSTRet: '0.00',
            vProd:     fmt2(vProd),
            vFrete:    '0.00',
            vSeg:      '0.00',
            vDesc:     '0.00',
            vII:       '0.00',
            vIPI:      '0.00',
            vIPIDevol: '0.00',
            vPIS:      '0.00',
            vCOFINS:   '0.00',
            vOutro:    '0.00',
            vNF:       fmt2(vNF),
          },
        },
        transp: {
          modFrete: '9',  // sem frete
        },
        pag: {
          detPag: {
            tPag: formaPagamento,
            vPag: fmt2(vNF),
          },
        },
        infAdic: {
          infCpl: 'EMPRESA OPTANTE PELO SIMPLES NACIONAL. ' +
                  `PIX/CNPJ: ${(cnpj).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`,
        },
      },
    },
  };

  const xmlStr = create(nfeObj).end({ prettyPrint: false });
  return { xmlStr, chave, numero };
}
