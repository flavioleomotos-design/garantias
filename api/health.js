const { prisma } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Método não permitido.' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ status: 'error', database: 'missing_configuration', message: 'Configuração do banco ausente no ambiente de execução.' });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.user.count();
    await prisma.tab.count();
    return res.status(200).json({ status: 'success', database: 'connected', schema: 'ready' });
  } catch (error) {
    console.error('[health] Falha no teste do PostgreSQL:', error.code || error.name);
    return res.status(503).json({
      status: 'error',
      database: 'unavailable',
      code: error.code || 'DATABASE_ERROR',
      message: 'A aplicação não conseguiu consultar o PostgreSQL.'
    });
  }
};
