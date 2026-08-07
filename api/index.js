const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// 1. Rota para buscar todos os alunos (resolve o "Carregando Alunos...")
app.get('/api/alunos', async (req, res) => {
  try {
    const alunos = await prisma.aluno.findMany({
      orderBy: { nome: 'asc' }
    });
    return res.status(200).json(alunos);
  } catch (error) {
    console.error('Erro ao buscar alunos:', error);
    return res.status(500).json({ error: 'Erro ao buscar alunos do banco' });
  }
});

// 2. Rota para cadastrar novo aluno
app.post('/api/alunos', async (req, res) => {
  const { nome, turma, fone, qrcode, cafe, almoco } = req.body;

  if (!nome || !qrcode) {
    return res.status(400).json({ error: 'Nome e QR Code são obrigatórios.' });
  }

  try {
    const novoAluno = await prisma.aluno.create({
      data: {
        nome,
        turma: turma || '',
        fone: fone || '',
        qrcode: String(qrcode).trim(),
        cafe: Boolean(cafe),
        almoco: Boolean(almoco)
      }
    });
    return res.status(201).json(novoAluno);
  } catch (error) {
    console.error('Erro ao cadastrar aluno:', error);
    // Código P2002 indica duplicidade de campo único (qrcode)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Erro ao cadastrar. Verifique se o QR Code já existe.' });
    }
    return res.status(500).json({ error: 'Erro interno ao salvar no banco.' });
  }
});

// 3. Rota para registrar presença/refeição via QR Code
app.post('/api/presenca', async (req, res) => {
  const { qrcode, cafe, almoco } = req.body;

  try {
    const aluno = await prisma.aluno.findUnique({
      where: { qrcode: String(qrcode).trim() }
    });

    if (!aluno) {
      return res.status(404).json({ error: 'Aluno não encontrado com este QR Code.' });
    }

    const agora = new Date();
    const dataAtual = agora.toLocaleDateString('pt-BR');
    const horaAtual = agora.toLocaleTimeString('pt-BR');

    const historico = await prisma.historico.create({
      data: {
        alunoId: aluno.id,
        nome: aluno.nome,
        turma: aluno.turma,
        fone: aluno.fone,
        qrcode: aluno.qrcode,
        data: dataAtual,
        hora: horaAtual,
        cafe: Boolean(cafe),
        almoco: Boolean(almoco)
      }
    });

    return res.status(200).json({ mensagem: 'Presença registrada!', historico, aluno });
  } catch (error) {
    console.error('Erro ao registrar presença:', error);
    return res.status(500).json({ error: 'Erro ao processar leitura do QR Code.' });
  }
});

// Exporta o app para a Vercel Serverless Function
module.exports = app;