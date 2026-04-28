// Rondônia (RO) — cUF=11 — possui servidor NF-e próprio
// Referência: Portal SEFAZ RO + Manual de Integração NF-e v6.00
// URLs atualizadas conforme documentação oficial SEFAZ RO

export const SEFAZ_RO = {
  homologacao: {
    autorizacao:    'https://hnfe.sefaz.ro.gov.br/nfeweb/services/NFeAutorizacao4',
    retAutorizacao: 'https://hnfe.sefaz.ro.gov.br/nfeweb/services/NFeRetAutorizacao4',
    consulta:       'https://hnfe.sefaz.ro.gov.br/nfeweb/services/NFeConsultaProtocolo4',
    statusServico:  'https://hnfe.sefaz.ro.gov.br/nfeweb/services/NFeStatusServico4',
    recepcaoEvento: 'https://hnfe.sefaz.ro.gov.br/nfeweb/services/NFeRecepcaoEvento4',
  },
  producao: {
    autorizacao:    'https://nfe.sefaz.ro.gov.br/nfeweb/services/NFeAutorizacao4',
    retAutorizacao: 'https://nfe.sefaz.ro.gov.br/nfeweb/services/NFeRetAutorizacao4',
    consulta:       'https://nfe.sefaz.ro.gov.br/nfeweb/services/NFeConsultaProtocolo4',
    statusServico:  'https://nfe.sefaz.ro.gov.br/nfeweb/services/NFeStatusServico4',
    recepcaoEvento: 'https://nfe.sefaz.ro.gov.br/nfeweb/services/NFeRecepcaoEvento4',
  },
};

export function getSefazUrls() {
  const ambiente = process.env.NODE_ENV === 'producao' ? 'producao' : 'homologacao';
  return SEFAZ_RO[ambiente];
}

export const CODIGO_UF_RO = '11';
export const UF_RO = 'RO';
