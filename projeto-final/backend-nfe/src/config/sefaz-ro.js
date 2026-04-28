// Rondônia (RO) usa SVRS - SEFAZ Virtual do Rio Grande do Sul
// RO não possui servidor próprio de NF-e
// Referência: Manual de Integração NF-e v6.00, Tabela de Webservices por UF

export const SEFAZ_RO = {
  homologacao: {
    autorizacao:    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consulta:       'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta2/NfeConsulta4.asmx',
    statusServico:  'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRecepcaoEvento4/NfeRecepcaoEvento4.asmx',
  },
  producao: {
    autorizacao:    'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consulta:       'https://nfe.svrs.rs.gov.br/ws/NfeConsulta2/NfeConsulta4.asmx',
    statusServico:  'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe.svrs.rs.gov.br/ws/NfeRecepcaoEvento4/NfeRecepcaoEvento4.asmx',
  },
};

export function getSefazUrls() {
  const ambiente = process.env.NODE_ENV === 'producao' ? 'producao' : 'homologacao';
  return SEFAZ_RO[ambiente];
}

export const CODIGO_UF_RO = '11';
export const UF_RO = 'RO';
