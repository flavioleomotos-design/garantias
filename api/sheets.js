const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const DEFAULT_COLUMNS = [
  'Status', 'Cód. Barras', 'Descrição', 'Fornecedor', 'Defeito',
  'Quantidade', 'Imagem', 'Observação', 'Anotações'
];

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    try {
      const tabs = await prisma.tab.findMany();
      const sheets = {};

      if (tabs.length === 0) {
        sheets.Garantias = {
          columns: DEFAULT_COLUMNS,
          hiddenColumns: [],
          customColumns: [],
          rows: []
        };
      } else {
        for (const tab of tabs) {
          sheets[tab.name] = {
            columns: tab.columns,
            hiddenColumns: tab.hiddenColumns,
            customColumns: tab.customColumns,
            rows: tab.rows
          };
        }
      }

      return res.status(200).json({ status: 'success', sheets });
    } catch (error) {
      console.error('Erro ao consultar abas:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Não foi possível consultar os dados. Verifique a conexão com o banco.'
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const { sheetName, columns, hiddenColumns, customColumns, rows } = req.body || {};

      if (
        typeof sheetName !== 'string' || !sheetName.trim() ||
        !Array.isArray(columns) || !Array.isArray(hiddenColumns) ||
        !Array.isArray(customColumns) || !Array.isArray(rows)
      ) {
        return res.status(400).json({
          status: 'error',
          message: 'Dados inválidos para salvar a aba.'
        });
      }

      await prisma.tab.upsert({
        where: { name: sheetName.trim() },
        update: { columns, hiddenColumns, customColumns, rows },
        create: {
          name: sheetName.trim(),
          columns,
          hiddenColumns,
          customColumns,
          rows
        }
      });

      return res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Erro ao salvar aba:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Não foi possível salvar os dados. Verifique a conexão com o banco.'
      });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({
    status: 'error',
    message: 'Método não permitido.'
  });
};
