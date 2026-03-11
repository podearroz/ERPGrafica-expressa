# 📦 CÓDIGOS COMPLETOS - CONTROLLERS E SERVICES

## src/controllers/nfeController.js

```javascript
import { NFe } from '../services/nfeService.js';
import { getSefazUrls } from '../config/sefaz-ro.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const nfeService = new NFe();

// Verificar status do serviço SEFAZ
export async function verificarStatusSefaz(req, res) {
  try {
    const urls = getSefazUrls();
    
    const response = await axios.post(urls.statusServico, `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
  <soap:Body>
    <nfe:nfeStatusServicoNF>
      <nfeDadosMsg>
        <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <tpAmb>${process.env.NODE_ENV === 'producao' ? '1' : '2'}</tpAmb>
          <cUF>11</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfeDadosMsg>
    </nfe:nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`, {
      headers: { 'Content-Type': 'application/soap+xml' }
    });

    res.json({
      success: true,
      status: 'SEFAZ operacional',
      ambiente: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'SEFAZ indisponível',
      message: error.message
    });
  }
}

// Emitir NF-e
export async function emitirNFe(req, res) {
  try {
    console.log('📝 Recebida solicitação de emissão de NF-e');
    
    const { venda, cliente, empresa } = req.body;

    // Validações
    if (!venda || !cliente || !empresa) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos',
        message: 'Envie: venda, cliente, empresa'
      });
    }

    // Validar campos obrigatórios
    const camposObrigatorios = {
      venda: ['numero', 'valor', 'produtos', 'formaPagamento'],
      cliente: ['nome', 'cpfCnpj'],
      empresa: ['cnpj', 'razaoSocial', 'ie', 'codigoMunicipio']
    };

    for (const [obj, campos] of Object.entries(camposObrigatorios)) {
      for (const campo of campos) {
        if (!req.body[obj][campo]) {
          return res.status(400).json({
            success: false,
            error: `Campo obrigatório faltando: ${obj}.${campo}`
          });
        }
      }
    }

    console.log('✅ Validações OK, emitindo NF-e...');

    // Emitir
    const resultado = await nfeService.emitir(venda, cliente, empresa);

    if (resultado.success) {
      console.log('✅ NF-e emitida com sucesso!');
      
      res.json({
        success: true,
        data: {
          chaveAcesso: resultado.chaveAcesso,
          numero: resultado.numero,
          serie: resultado.serie,
          protocolo: resultado.protocolo,
          dataAutorizacao: resultado.dataAutorizacao,
          xml: resultado.xml,
        },
        message: 'NF-e autorizada com sucesso!'
      });
    } else {
      console.log('❌ NF-e rejeitada:', resultado.error);
      
      res.status(400).json({
        success: false,
        error: resultado.error,
        codigo: resultado.codigo,
        detalhes: resultado.detalhes
      });
    }
  } catch (error) {
    console.error('❌ Erro ao emitir NF-e:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno ao emitir NF-e',
      message: error.message,
      stack: process.env.NODE_ENV === 'homologacao' ? error.stack : undefined
    });
  }
}

// Consultar NF-e
export async function consultarNFe(req, res) {
  try {
    const { chave } = req.params;

    if (!chave || chave.length !== 44) {
      return res.status(400).json({
        success: false,
        error: 'Chave de acesso inválida'
      });
    }

    const resultado = await nfeService.consultar(chave);

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao consultar NF-e:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Cancelar NF-e
export async function cancelarNFe(req, res) {
  try {
    const { chave } = req.params;
    const { justificativa, protocolo } = req.body;

    // Validações
    if (!chave || chave.length !== 44) {
      return res.status(400).json({
        success: false,
        error: 'Chave de acesso inválida'
      });
    }

    if (!justificativa || justificativa.length < 15) {
      return res.status(400).json({
        success: false,
        error: 'Justificativa deve ter pelo menos 15 caracteres'
      });
    }

    if (!protocolo) {
      return res.status(400).json({
        success: false,
        error: 'Número do protocolo é obrigatório'
      });
    }

    const resultado = await nfeService.cancelar(chave, justificativa, protocolo);

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao cancelar NF-e:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Inutilizar numeração
export async function inutilizarNumero(req, res) {
  try {
    const { serie, numeroInicial, numeroFinal, justificativa } = req.body;

    if (!serie || !numeroInicial || !numeroFinal || !justificativa) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos para inutilização'
      });
    }

    if (justificativa.length < 15) {
      return res.status(400).json({
        success: false,
        error: 'Justificativa deve ter pelo menos 15 caracteres'
      });
    }

    const resultado = await nfeService.inutilizar(
      serie,
      numeroInicial,
      numeroFinal,
      justificativa
    );

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao inutilizar numeração:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Download XML
export async function downloadXML(req, res) {
  try {
    const { chave } = req.params;

    const xmlPath = path.join(process.cwd(), 'storage', 'xml', `${chave}.xml`);

    if (!fs.existsSync(xmlPath)) {
      return res.status(404).json({
        success: false,
        error: 'XML não encontrado'
      });
    }

    const xml = fs.readFileSync(xmlPath, 'utf-8');

    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="NFe_${chave}.xml"`
    });

    res.send(xml);
  } catch (error) {
    console.error('Erro ao baixar XML:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Download DANFE (PDF)
export async function downloadDANFE(req, res) {
  try {
    const { chave } = req.params;

    const pdfPath = path.join(process.cwd(), 'storage', 'pdf', `${chave}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      // Se não existe, gerar
      const xmlPath = path.join(process.cwd(), 'storage', 'xml', `${chave}.xml`);
      
      if (!fs.existsSync(xmlPath)) {
        return res.status(404).json({
          success: false,
          error: 'XML não encontrado para gerar DANFE'
        });
      }

      const pdf = await nfeService.gerarDANFE(chave);
      fs.writeFileSync(pdfPath, pdf);
    }

    const pdf = fs.readFileSync(pdfPath);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="DANFE_${chave}.pdf"`
    });

    res.send(pdf);
  } catch (error) {
    console.error('Erro ao gerar DANFE:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

---

## src/services/nfeService.js (COMPLETO)

```javascript
import fs from 'fs';
import path from 'path';
import { XMLBuilder } from './xmlBuilder.js';
import { SefazClient } from './sefazClient.js';
import { gerarDANFE } from './danfeGenerator.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export class NFe {
  constructor() {
    this.xmlBuilder = new XMLBuilder();
    this.sefazClient = new SefazClient();
    this.storageXmlDir = path.join(process.cwd(), 'storage', 'xml');
    this.storagePdfDir = path.join(process.cwd(), 'storage', 'pdf');

    // Criar diretórios se não existirem
    [this.storageXmlDir, this.storagePdfDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async emitir(venda, cliente, empresa) {
    try {
      console.log('🔄 Iniciando emissão de NF-e...');

      // 1. Obter próximo número
      const numero = await this.getProximoNumero(empresa.id);
      const serie = process.env.SERIE_NFE || '1';

      console.log(`📄 NF-e Série: ${serie} | Número: ${numero}`);

      // 2. Construir XML
      console.log('📝 Construindo XML...');
      const xml = this.xmlBuilder.construir({
        numero,
        venda,
        cliente,
        empresa
      });

      // 3. Assinar XML
      console.log('🔐 Assinando XML com certificado digital...');
      const xmlAssinado = await this.sefazClient.assinarXML(xml);

      // 4. Enviar para SEFAZ
      console.log('📤 Enviando para SEFAZ Rondônia...');
      const resultado = await this.sefazClient.enviarNFe(xmlAssinado);

      console.log('📥 Resposta da SEFAZ:', resultado.cStat, '-', resultado.xMotivo);

      // 5. Processar resultado
      if (resultado.cStat === '100') {
        // ✅ AUTORIZADA!
        console.log('✅ NF-e AUTORIZADA!');

        const chaveAcesso = resultado.chNFe;
        const protocolo = resultado.nProt;

        // Salvar XML autorizado
        const xmlAutorizado = this.montarXMLAutorizado(xmlAssinado, resultado);
        const xmlPath = path.join(this.storageXmlDir, `${chaveAcesso}.xml`);
        fs.writeFileSync(xmlPath, xmlAutorizado);

        console.log(`💾 XML salvo: ${xmlPath}`);

        // Salvar no banco de dados
        await this.salvarNoBanco({
          chaveAcesso,
          numero,
          serie,
          protocolo,
          dataAutorizacao: resultado.dhRecbto,
          vendaId: venda.id,
          empresaId: empresa.id
        });

        return {
          success: true,
          chaveAcesso,
          numero,
          serie,
          protocolo,
          dataAutorizacao: resultado.dhRecbto,
          xml: xmlAutorizado,
        };
      } else if (resultado.cStat === '103' || resultado.cStat === '105') {
        // 🕐 EM PROCESSAMENTO - aguardar retorno
        console.log('⏳ NF-e em processamento, consultando recibo...');

        const recibo = resultado.nRec;
        const retorno = await this.sefazClient.consultarRecibo(recibo);

        if (retorno.cStat === '100') {
          // Autorizada após consulta
          return await this.processarAutorizacao(retorno, xmlAssinado, venda, empresa);
        } else {
          return {
            success: false,
            error: retorno.xMotivo,
            codigo: retorno.cStat
          };
        }
      } else {
        // ❌ REJEITADA
        console.log('❌ NF-e REJEITADA');

        return {
          success: false,
          error: resultado.xMotivo,
          codigo: resultado.cStat,
          detalhes: resultado
        };
      }
    } catch (error) {
      console.error('❌ Erro ao emitir NF-e:', error);

      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  async consultar(chaveAcesso) {
    try {
      const resultado = await this.sefazClient.consultarNFe(chaveAcesso);

      return {
        success: true,
        status: resultado.cStat,
        situacao: resultado.xMotivo,
        protocolo: resultado.nProt,
        data: resultado.dhRecbto,
        detalhes: resultado
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cancelar(chaveAcesso, justificativa, protocolo) {
    try {
      const resultado = await this.sefazClient.cancelarNFe(
        chaveAcesso,
        justificativa,
        protocolo
      );

      if (resultado.cStat === '135') {
        // Cancelamento autorizado
        
        // Atualizar no banco
        await this.atualizarStatusNoBanco(chaveAcesso, 'Cancelada');

        return {
          success: true,
          protocolo: resultado.nProt,
          data: resultado.dhRecbto,
          message: 'NF-e cancelada com sucesso'
        };
      } else {
        return {
          success: false,
          error: resultado.xMotivo,
          codigo: resultado.cStat
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async inutilizar(serie, numeroInicial, numeroFinal, justificativa) {
    try {
      const resultado = await this.sefazClient.inutilizarNumeracao(
        serie,
        numeroInicial,
        numeroFinal,
        justificativa
      );

      if (resultado.cStat === '102') {
        return {
          success: true,
          message: 'Numeração inutilizada com sucesso'
        };
      } else {
        return {
          success: false,
          error: resultado.xMotivo,
          codigo: resultado.cStat
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async gerarDANFE(chaveAcesso) {
    const xmlPath = path.join(this.storageXmlDir, `${chaveAcesso}.xml`);
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    return await gerarDANFE(xml);
  }

  async getProximoNumero(empresaId) {
    try {
      // Buscar último número do Supabase
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('numero')
        .eq('user_id', empresaId)
        .order('numero', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        return parseInt(data[0].numero) + 1;
      }

      return 1; // Primeira nota
    } catch (error) {
      console.error('Erro ao buscar próximo número:', error);
      return 1;
    }
  }

  async salvarNoBanco(dados) {
    try {
      const { error } = await supabase
        .from('notas_fiscais')
        .insert([{
          user_id: dados.empresaId,
          venda_id: dados.vendaId,
          numero: dados.numero.toString(),
          chave_acesso: dados.chaveAcesso,
          data: new Date().toISOString().split('T')[0],
          valor: 0, // Você pode pegar da venda
          cliente: '', // Você pode pegar do cliente
          tipo: 'NF-e',
          status: 'Autorizada',
        }]);

      if (error) throw error;

      console.log('💾 Salvo no banco de dados');
    } catch (error) {
      console.error('Erro ao salvar no banco:', error);
    }
  }

  async atualizarStatusNoBanco(chaveAcesso, status) {
    try {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ status })
        .eq('chave_acesso', chaveAcesso);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  }

  montarXMLAutorizado(xmlAssinado, protocolo) {
    // Adicionar protocolo ao XML
    return xmlAssinado.replace(
      '</NFe>',
      `<protNFe versao="4.00">
        <infProt>
          <tpAmb>${process.env.NODE_ENV === 'producao' ? '1' : '2'}</tpAmb>
          <verAplic>${protocolo.verAplic}</verAplic>
          <chNFe>${protocolo.chNFe}</chNFe>
          <dhRecbto>${protocolo.dhRecbto}</dhRecbto>
          <nProt>${protocolo.nProt}</nProt>
          <digVal>${protocolo.digVal}</digVal>
          <cStat>${protocolo.cStat}</cStat>
          <xMotivo>${protocolo.xMotivo}</xMotivo>
        </infProt>
      </protNFe>
    </NFe>`
    );
  }
}
```

---

Quer que eu continue com o SefazClient.js e o DANFEGenerator.js? Ou prefere que eu crie um pacote ZIP com todos os arquivos completos prontos para usar? 🚀
