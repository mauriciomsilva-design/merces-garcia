const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json({ limit: '10mb' }));

// Middleware para permitir requisições no Vercel (CORS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Normalização do caminho da URL vinda da Vercel
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace('/api', '');
  }
  if (req.url === '') req.url = '/';
  next();
});

// POST /api/alunos -> Cadastrar
app.post('/alunos', async (req, res) => {
  try {
    const { nome, turma, fone, qrcode, cafe, almoco } = req.body;

    if (!nome || !qrcode) {
      return res.status(400).json({ error: 'Nome e QR Code são obrigatórios.' });
    }

    const qrcodeLimpo = String(qrcode).trim().toLowerCase();

    // Verifica se o QR Code já existe no banco
    const existente = await prisma.aluno.findFirst({
      where: { qrcode: qrcodeLimpo }
    });

    if (existente) {
      return res.status(400).json({ error: `O QR Code "${qrcode}" já está cadastrado para o aluno ${existente.nome}.` });
    }

    const novo = await prisma.aluno.create({
      data: {
        nome,
        turma: turma || '',
        fone: fone || '',
        qrcode: qrcodeLimpo,
        cafe: Boolean(cafe),
        almoco: Boolean(almoco)
      }
    });

    return res.status(201).json(novo);
  } catch (err) {
    console.error("Erro interno no banco:", err);
    return res.status(500).json({ error: `Erro no Servidor/Banco: ${err.message}` });
  }
});

// GET /api/alunos -> Listar todos
app.get('/alunos', async (req, res) => {
  try {
    const lista = await prisma.aluno.findMany({
      orderBy: { id: 'desc' }
    });
    return res.json(lista);
  } catch (err) {
    return res.status(500).json({ error: `Erro ao buscar alunos: ${err.message}` });
  }
});

// DELETE /api/alunos/:id
app.delete('/alunos/:id', async (req, res) => {
  try {
    await prisma.aluno.delete({ where: { id: req.params.id } });
    return res.json({ status: 'excluido' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao excluir aluno.' });
  }
});

module.exports = app;