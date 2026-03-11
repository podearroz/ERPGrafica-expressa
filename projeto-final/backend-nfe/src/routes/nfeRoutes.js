import express from 'express';
import { emitirNFe, consultarNFe, cancelarNFe, downloadXML, downloadDANFE } from '../controllers/nfeController.js';

const router = express.Router();

router.post('/emitir', emitirNFe);
router.get('/consultar/:chave', consultarNFe);
router.post('/cancelar/:chave', cancelarNFe);
router.get('/xml/:chave', downloadXML);
router.get('/danfe/:chave', downloadDANFE);

export default router;
