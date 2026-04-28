// ═══════════════════════════════════════════════════════════════════════════
// Teste de emissao NF-e em homologacao — SEFAZ RO
// Execute: node test-nfe.js
// Prerequisito: .env configurado com certificado valido
// ═══════════════════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

import { buildNFeXml, gerarChaveAcesso } from './src/services/nfeXmlBuilder.js';
import { assinarXml, autorizarNFe, checkStatusSefaz } from './src/services/sefazService.js';
import { getInfoCertificado } from './src/services/certificadoService.js';

// ── Utilitarios ─────────────────────────────────────────────────────────────

function sep(titulo) {
  console.log('');
  console.log('═'.repeat(60));
  console.log(` ${titulo}`);
  console.log('═'.repeat(60));
}

function ok(msg)   { console.log(`  [OK]  ${msg}`); }
function err(msg)  { console.log(`  [ERR] ${msg}`); }
function info(msg) { console.log(`  [>>]  ${msg}`); }

// ── Teste 1: Verificacao do certificado ─────────────────────────────────────

async function testeCertificado() {
  sep('TESTE 1 — Certificado Digital');
  try {
    const cert = getInfoCertificado();
    ok(`Titular:       ${cert.titular}`);
    ok(`CNPJ:          ${cert.cnpj}`);
    ok(`Validade:      ${cert.validade}`);
    ok(`Emissor:       ${cert.emissor}`);
    ok(`Dias restantes:${cert.diasRestantes}`);
    if (cert.expirado) {
      err('CERTIFICADO EXPIRADO! Renove antes de emitir NF-e.');
    } else {
      ok('Certificado VALIDO.');
    }
    return true;
  } catch (e) {
    err(`Falha ao carregar certificado: ${e.message}`);
    err('Verifique CERTIFICADO_PATH e CERTIFICADO_SENHA no .env');
    return false;
  }
}

// ── Teste 2: Calculo da chave de acesso ────────────────────────────────────

async function testeChave() {
  sep('TESTE 2 — Chave de Acesso (44 digitos + DV modulo 11)');
  try {
    const cUF  = process.env.SEFAZ_CODIGO_UF || '11';
    const cnpj = (process.env.EMPRESA_CNPJ || '07240770000150').replace(/\D/g, '');
    const { chave, cNF, cDV } = gerarChaveAcesso({
      cUF, aamm: '2604', cnpj, serie: 1, nNF: 1, cNF: '12345678',
    });
    if (chave.length !== 44) {
      err(`Chave tem ${chave.length} digitos (esperado 44): ${chave}`);
      return false;
    }
    ok(`Chave gerada:  ${chave}`);
    ok(`Digitos:       ${chave.length} (correto: 44)`);
    ok(`cNF:           ${cNF}`);
    ok(`cDV:           ${cDV}`);
    return true;
  } catch (e) {
    err(`Falha: ${e.message}`);
    return false;
  }
}

// ── Teste 3: Status SEFAZ RO ────────────────────────────────────────────────

async function testeStatusSefaz() {
  sep('TESTE 3 — Status SEFAZ RO');
  info(`Ambiente: ${process.env.NODE_ENV || 'homologacao'}`);
  info(`Endpoint: https://nfe-homologacao.svrs.rs.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx`);
  try {
    const status = await checkStatusSefaz();
    ok(`cStat:   ${status.cStat}`);
    ok(`xMotivo: ${status.xMotivo}`);
    ok(`Ambiente:${status.tpAmb}`);
    if (status.dhRecbto) ok(`dhRecbto:${status.dhRecbto}`);
    if (status.cStat === '107') {
      ok('SEFAZ RO ONLINE e operacional.');
    } else {
      err(`SEFAZ retornou cStat=${status.cStat} — pode nao estar operacional.`);
    }
    return status.cStat === '107';
  } catch (e) {
    err(`Falha ao consultar status: ${e.message}`);
    err('Verifique conectividade e certificado digital.');
    return false;
  }
}

// ── Teste 4: Geracao e assinatura do XML ───────────────────────────────────

async function testeGeracaoXml() {
  sep('TESTE 4 — Geracao e Assinatura do XML NF-e');
  try {
    const { xmlStr, chave, numero } = buildNFeXml({
      numero:       999,
      serie:        1,
      naturezaOperacao: 'Venda de producao do estabelecimento',
      destinatario: {
        nome:       'DESTINATARIO TESTE HOMOLOGACAO',
        cpf_cnpj:   '11144477735',   // CPF invalido — so para teste
        logradouro: 'Rua Teste',
        numero:     '100',
        bairro:     'Centro',
        municipio:  'VILHENA',
        uf:         'RO',
        cep:        '76980000',
      },
      itens: [
        {
          descricao:      'PRODUTO TESTE NF-E HOMOLOGACAO',
          ncm:            '49111090',
          cfop:           '5101',
          unidade:        'UN',
          quantidade:     1,
          valor_unitario: 1.00,
          valor_total:    1.00,
        },
      ],
      formaPagamento: '01',
    });

    ok(`XML gerado. Chave: ${chave} (${chave.length} digitos)`);
    ok(`Numero: ${numero} | Tamanho XML: ${xmlStr.length} bytes`);

    if (chave.length !== 44) {
      err(`CHAVE COM ${chave.length} DIGITOS — ESPERADO 44!`);
      return { sucesso: false };
    }

    // Verifica tpAmb
    const tpAmb = process.env.NODE_ENV === 'producao' ? '1' : '2';
    if (xmlStr.includes(`<tpAmb>${tpAmb}</tpAmb>`)) {
      ok(`tpAmb=${tpAmb} correto no XML.`);
    } else {
      err(`tpAmb incorreto no XML. Esperado: ${tpAmb}`);
    }

    // Verifica xNome do destinatario em homologacao
    if (tpAmb === '2') {
      const xNomeCorreto = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
      if (xmlStr.includes(xNomeCorreto)) {
        ok('xNome do destinatario correto para homologacao.');
      } else {
        err('xNome do destinatario INCORRETO para homologacao!');
      }
    }

    // Verifica verProc
    if (xmlStr.includes('<verProc>4.00</verProc>')) {
      ok('verProc=4.00 correto.');
    } else {
      err('verProc incorreto — deve ser 4.00.');
    }

    // Verifica timezone RO
    if (xmlStr.includes('-04:00')) {
      ok('Timezone -04:00 (RO) correto no dhEmi.');
    } else {
      err('Timezone incorreto no dhEmi — esperado -04:00 para RO.');
    }

    // Assinatura
    info('Assinando XML (RSA-SHA1 + C14N)...');
    const xmlAssinado = assinarXml(xmlStr);
    if (xmlAssinado.includes('<Signature')) {
      ok('Assinatura XMLDSig inserida no XML com sucesso.');
    } else {
      err('Assinatura nao encontrada no XML!');
    }

    return { sucesso: true, xmlAssinado, chave };
  } catch (e) {
    err(`Falha: ${e.message}`);
    console.error(e);
    return { sucesso: false };
  }
}

// ── Teste 5: Emissao NF-e de homologacao ───────────────────────────────────

async function testeEmissao(xmlAssinado, chaveEsperada) {
  sep('TESTE 5 — Emissao NF-e (homologacao)');
  info('ATENCAO: Este teste envia uma NF-e real para a SEFAZ em ambiente de homologacao.');
  info(`Chave esperada: ${chaveEsperada}`);

  try {
    const resultado = await autorizarNFe(xmlAssinado);

    info(`cStat:     ${resultado.cStat}`);
    info(`xMotivo:   ${resultado.xMotivo}`);
    info(`Chave:     ${resultado.chave || 'N/A'}`);
    info(`Protocolo: ${resultado.protocolo || 'N/A'}`);
    info(`dhRecbto:  ${resultado.dhRecbto || 'N/A'}`);

    if (resultado.autorizado) {
      ok('NF-e AUTORIZADA! cStat=100.');
      ok(`Chave:     ${resultado.chave}`);
      ok(`Protocolo: ${resultado.protocolo}`);
      ok(`Data/Hora: ${resultado.dhRecbto}`);

      if (resultado.nfeProcXml) {
        ok(`nfeProc gerado: ${resultado.nfeProcXml.length} bytes.`);
      } else {
        err('nfeProcXml nao gerado — verifique montarNFeProc().');
      }
    } else if (resultado.cStat === '103') {
      info('cStat=103: NF-e em processamento. Consulte o lote mais tarde.');
    } else {
      err(`NF-e REJEITADA pela SEFAZ: cStat=${resultado.cStat} | ${resultado.xMotivo}`);
      err('Verifique os dados da NF-e e o certificado.');
    }

    return resultado;
  } catch (e) {
    err(`Falha na emissao: ${e.message}`);
    console.error(e);
    return null;
  }
}

// ── Execucao principal ──────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   SUITE DE TESTES NF-e — SEFAZ RO (Rondonia)           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   NODE_ENV:  ${(process.env.NODE_ENV || 'homologacao').padEnd(42)}║`);
  console.log(`║   EMPRESA:   ${(process.env.EMPRESA_RAZAO_SOCIAL || '').slice(0, 42).padEnd(42)}║`);
  console.log(`║   CNPJ:      ${(process.env.EMPRESA_CNPJ || '').padEnd(42)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Teste 1 — Certificado
  const certOk = await testeCertificado();

  // Teste 2 — Chave de acesso (nao precisa de certificado)
  await testeChave();

  // Testes que precisam de certificado valido
  if (!certOk) {
    sep('ABORTANDO');
    err('Nao foi possivel carregar o certificado. Corrija antes de continuar.');
    process.exit(1);
  }

  // Teste 3 — Status SEFAZ
  const sefazOnline = await testeStatusSefaz();

  // Teste 4 — Geracao e assinatura XML
  const { sucesso, xmlAssinado, chave } = await testeGeracaoXml();

  // Teste 5 — Emissao (so executa se SEFAZ online e XML OK)
  if (sucesso && sefazOnline && xmlAssinado) {
    await testeEmissao(xmlAssinado, chave);
  } else {
    sep('TESTE 5 — Emissao NF-e');
    if (!sefazOnline) {
      err('SEFAZ nao esta online — teste de emissao pulado.');
    }
    if (!sucesso) {
      err('XML invalido — teste de emissao pulado.');
    }
  }

  sep('FIM DOS TESTES');
  console.log('');
}

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
