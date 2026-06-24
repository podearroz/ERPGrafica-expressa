import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nfeRoutes from './routes/nfeRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/nfe', nfeRoutes);
app.use('/nfe', nfeRoutes);        // alias — compatibilidade com VITE_NFE_API_URL sem /api

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    ambiente: process.env.NODE_ENV,
    uf: process.env.SEFAZ_UF,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🚀 API NF-e - Rondônia             ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║   Porta: ${PORT}                        ║`);
  console.log(`║   Ambiente: ${process.env.NODE_ENV?.padEnd(12) || 'homologacao'}║`);
  console.log(`║   SEFAZ: ${process.env.SEFAZ_UF || 'RO'}                           ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('📝 Endpoints disponíveis:');
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/api/nfe/emitir`);
  console.log(`   GET  http://localhost:${PORT}/api/nfe/consultar/:chave`);
  console.log('');
});

export default app;
