import express from 'express';
import { emitirNFe, consultarNFe, cancelarNFe, downloadXML, downloadDANFE, previewDANFE, statusSefaz } from '../controllers/nfeController.js';

const router = express.Router();

router.get('/status',           statusSefaz);    // Verifica se a SEFAZ está online
router.post('/emitir',          emitirNFe);       // Emite NF-e real
router.get('/consultar/:chave', consultarNFe);   // Consulta NF-e na SEFAZ
router.post('/cancelar/:chave', cancelarNFe);    // Cancela NF-e
router.get('/xml/:chave',       downloadXML);    // Download XML assinado
router.post('/danfe',           downloadDANFE);  // Gera DANFE em PDF (Puppeteer)
router.post('/danfe/preview',   previewDANFE);   // Preview DANFE em HTML (iframe)

export default router;
