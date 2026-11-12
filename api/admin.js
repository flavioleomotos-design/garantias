const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

function authorized(req) {
  const configured = process.env.ADMIN_PASSWORD;
  const supplied = req.headers['x-admin-password'];
  if (!configured || typeof supplied !== 'string') return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(204).end();
  }
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ status: 'error', message: 'Configure ADMIN_PASSWORD nas variáveis de ambiente da Vercel.' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ status: 'error', message: 'Senha administrativa inválida.' });
  }

  try {
    if (req.method === 'GET') {
      const tabs = await prisma.tab.findMany({ orderBy: { name: 'asc' } });
      return res.status(200).json({ status: 'success', tabs });
    }
    if (req.method === 'PUT') {
      const { sheetName, rowIndex, row } = req.body || {};
      if (typeof sheetName !== 'string' || !Number.isInteger(rowIndex) || rowIndex < 0 || !Array.isArray(row)) {
        return res.status(400).json({ status: 'error', message: 'Dados inválidos para atualizar o registro.' });
      }
      const tab = await prisma.tab.findUnique({ where: { name: sheetName } });
      if (!tab) return res.status(404).json({ status: 'error', message: 'Aba não encontrada.' });
      const rows = Array.isArray(tab.rows) ? [...tab.rows] : [];
      if (rowIndex >= rows.length || row.length !== tab.columns.length) {
        return res.status(400).json({ status: 'error', message: 'Registro ou quantidade de colunas inválida.' });
      }
      rows[rowIndex] = row.map(value => value == null ? '' : String(value));
      await prisma.tab.update({ where: { name: sheetName }, data: { rows } });
      return res.status(200).json({ status: 'success' });
    }
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ status: 'error', message: 'Método não permitido.' });
  } catch (error) {
    console.error('Erro no painel administrativo:', error);
    return res.status(500).json({ status: 'error', message: 'Não foi possível processar a operação administrativa.' });
  }
};
