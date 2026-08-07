const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- ALUNOS ---
app.get('/api/alunos', async (req, res) => {
  try {
    const alunos = await prisma.aluno.findMany({ orderBy: { nome: 'asc' } });
    res.json(alunos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alunos', async (req, res) => {
  try {
    const { nome, turma, fone, qrcode, cafe, almoco } = req.body;
    const novo = await prisma.aluno.create({
      data: { nome, turma, fone, qrcode, cafe: !!cafe, almoco: !!almoco }
    });
    res.json(novo);
  } catch (err) {
    res.status(400).json({ error: 'QR Code duplicado ou dados inválidos.' });
  }
});

app.delete('/api/alunos/:id', async (req, res) => {
  try {
    await prisma.aluno.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HISTÓRICO ---
app.get('/api/historico', async (req, res) => {
  try {
    const historico = await prisma.historico.findMany({ orderBy: { criadoEm: 'desc' } });
    res.json(historico);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/historico', async (req, res) => {
  try {
    const { alunoId, nome, turma, fone, qrcode, cafe, almoco } = req.body;
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR');
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const existente = await prisma.historico.findFirst({
      where: { data: dataStr, qrcode: qrcode }
    });

    let registro;
    if (existente) {
      registro = await prisma.historico.update({
        where: { id: existente.id },
        data: { cafe: !!cafe, almoco: !!almoco }
      });
    } else {
      registro = await prisma.historico.create({
        data: {
          alunoId: alunoId || null,
          nome, turma, fone, qrcode,
          data: dataStr,
          hora: horaStr,
          cafe: !!cafe,
          almoco: !!almoco
        }
      });
    }
    res.json(registro);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CONFIGURAÇÃO (FOTO DO APP) ---
app.get('/api/config/foto', async (req, res) => {
  try {
    const config = await prisma.config.findUnique({ where: { chave: 'foto_app' } });
    res.json({ foto: config ? config.valor : '' });
  } catch (err) {
    res.json({ foto: '' });
  }
});

app.post('/api/config/foto', async (req, res) => {
  try {
    const { foto } = req.body;
    await prisma.config.upsert({
      where: { chave: 'foto_app' },
      update: { valor: foto },
      create: { chave: 'foto_app', valor: foto }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;