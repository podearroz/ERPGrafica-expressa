// Rondônia (RO) — cUF=11 — usa SVRS (Sefaz Virtual RS) para NF-e
// RO está na lista de UFs que usam o autorizador SVRS (junto com AC, AL, AP, CE, DF, ES, PA, PB, PI, RJ, RN, RR, SC, SE, TO)
// Referência: Portal Nacional NF-e + Manual de Integração NF-e v6.00

export const SEFAZ_RO = {
  homologacao: {
    autorizacao:    'https://nfe-homologacao.svrs.rs.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consulta:       'https://nfe-homologacao.svrs.rs.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    statusServico:  'https://nfe-homologacao.svrs.rs.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/SRecepcaoEvento4/SRecepcaoEvento4.asmx',
  },
  producao: {
    autorizacao:    'https://nfe.svrs.rs.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consulta:       'https://nfe.svrs.rs.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    statusServico:  'https://nfe.svrs.rs.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe.svrs.rs.gov.br/ws/SRecepcaoEvento4/SRecepcaoEvento4.asmx',
  },
};

export function getSefazUrls() {
  const ambiente = process.env.NODE_ENV === 'producao' ? 'producao' : 'homologacao';
  return SEFAZ_RO[ambiente];
}

export const CODIGO_UF_RO = '11';
export const UF_RO = 'RO';
