import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _cache = null;

export function carregarCertificado() {
  if (_cache) return _cache;

  const senha = process.env.CERTIFICADO_SENHA || '';
  let pfxBuffer;

  // Suporte a certificado via variável de ambiente (base64) — usado em produção/Railway
  if (process.env.CERTIFICADO_BASE64) {
    pfxBuffer = Buffer.from(process.env.CERTIFICADO_BASE64, 'base64');
  } else {
    const pfxRelativo = process.env.CERTIFICADO_PATH || './certificados/certificado.pfx';
    const pfxPath = path.resolve(__dirname, '../../', pfxRelativo);

    if (!fs.existsSync(pfxPath)) {
      throw new Error(`Certificado não encontrado em: ${pfxPath}`);
    }

    pfxBuffer = fs.readFileSync(pfxPath);
  }
  const pfxDer = pfxBuffer.toString('binary');
  const p12Asn1 = forge.asn1.fromDer(pfxDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

  // Chave privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag) throw new Error('Chave privada não encontrada no certificado PFX');
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Certificado
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag) throw new Error('Certificado público não encontrado no PFX');
  const cert = certBag.cert;
  const certPem = forge.pki.certificateToPem(cert);

  // Buffer original do PFX para o https.Agent
  _cache = { privateKeyPem, certPem, cert, pfxBuffer, pfxSenha: senha };
  return _cache;
}

export function getInfoCertificado() {
  const { cert } = carregarCertificado();
  const agora = new Date();
  const validade = cert.validity.notAfter;
  return {
    titular: cert.subject.getField('CN')?.value || '',
    cnpj: cert.subject.getField('CN')?.value?.match(/\d{14}/)?.[0] || '',
    validade: validade.toLocaleDateString('pt-BR'),
    emissor: cert.issuer.getField('O')?.value || cert.issuer.getField('CN')?.value || '',
    expirado: agora > validade,
    diasRestantes: Math.floor((validade - agora) / (1000 * 60 * 60 * 24)),
  };
}
