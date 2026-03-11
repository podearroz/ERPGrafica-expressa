export const SEFAZ_RO = {
  homologacao: {
    autorizacao: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consulta: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    statusServico: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe-homologacao.sefin.ro.gov.br/ws/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
  producao: {
    autorizacao: 'https://nfe.sefin.ro.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.sefin.ro.gov.br/ws/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    consulta: 'https://nfe.sefin.ro.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    statusServico: 'https://nfe.sefin.ro.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx',
    recepcaoEvento: 'https://nfe.sefin.ro.gov.br/ws/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  }
};

export function getSefazUrls() {
  const ambiente = process.env.NODE_ENV === 'producao' ? 'producao' : 'homologacao';
  return SEFAZ_RO[ambiente];
}

export const CODIGO_UF_RO = '11';
export const UF_RO = 'RO';
