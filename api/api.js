const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Rota para listar todas as abas e dados
app.get('/api/sheets', async (req, res) => {
  try {
    const tabs = await prisma.tab.findMany();
    const sheetsData = {};
    
    if (tabs.length === 0) {
      // Retorna padrão inicial se estiver vazio
      sheetsData['Garantias'] = {
        columns: ['Status', 'Cód. Barras', 'Descrição', 'Fornecedor', 'Defeito', 'Quantidade', 'Imagem', 'Observação', 'Anotações'],
        hiddenColumns: [],
        customColumns: [],
        rows: []
      };
    } else {
      tabs.forEach(t => {
        sheetsData[t.name] = {
          columns: t.columns,
          hiddenColumns: t.hiddenColumns,
          customColumns: t.customColumns,
          rows: t.rows
        };
      });
    }
    res.json({ status: 'success', sheets: sheetsData });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Rota para salvar/atualizar os dados de uma aba específica
app.post('/api/sheets', async (req, res) => {
  try {
    const { sheetName, columns, hiddenColumns, customColumns, rows } = req.body;

    await prisma.tab.upsert({
      where: { name: sheetName },
      update: { columns, hiddenColumns, customColumns, rows },
      create: { name: sheetName, columns, hiddenColumns, customColumns, rows }
    });

    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));