const express = require('express');
const cors = require('cors');
const { PrismaClient, Prisma } = require('@prisma/client');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Reutiliza o cliente durante os reusos da função Serverless da Vercel.
const globalForPrisma = global;
const prisma = globalForPrisma.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

function normalizarQRCode(valor) {
  return String(valor ?? '').trim();
}

app.get('/api/alunos', async (req, res) => {
  try {
    const alunos = await prisma.aluno.findMany({
      orderBy: { nome: 'asc' }
    });
    res.json(alunos);
  } catch (err) {
    console.error('GET /api/alunos:', err);
    res.status(500).json({
      error: 'Erro ao buscar alunos.',
      detalhe: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.post('/api/alunos', async (req, res) => {
  const nome = String(req.body.nome ?? '').trim();
  const turma = String(req.body.turma ?? '').trim();
  const fone = String(req.body.fone ?? '').trim();
  const qrcode = normalizarQRCode(req.body.qrcode);
  const cafe = Boolean(req.body.cafe);
  const almoco = Boolean(req.body.almoco);

  if (!nome || !turma || !qrcode) {
    return res.status(400).json({
      error: 'Nome, turma e QR Code são obrigatórios.'
    });
  }

  try {
    // O QR da carteirinha é o identificador único do aluno.
    const alunoExistente = await prisma.aluno.findUnique({
      where: { qrcode }
    });

    if (alunoExistente) {
      return res.status(409).json({
        error: 'Este QR Code já está vinculado a outro aluno.',
        codigo: 'QR_DUPLICADO'
      });
    }

    const aluno = await prisma.aluno.create({
      data: {
        nome,
        turma,
        fone,
        qrcode,
        cafe,
        almoco
      }
    });

    return res.status(201).json(aluno);
  } catch (err) {
    console.error('POST /api/alunos:', err);

    // Trata especificamente uma violação de unicidade do Prisma.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({
        error: 'Este QR Code já está cadastrado.',
        codigo: 'QR_DUPLICADO'
      });
    }

    return res.status(500).json({
      error: 'Não foi possível cadastrar o aluno no Neon.',
      detalhe: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.delete('/api/alunos/:id', async (req, res) => {
  try {
    await prisma.aluno.delete({
      where: { id: req.params.id }
    });
    res.json({ mensagem: 'Aluno removido com sucesso.' });
  } catch (err) {
    console.error('DELETE /api/alunos/:id:', err);
    res.status(500).json({ error: 'Erro ao deletar aluno.' });
  }
});

app.post('/api/presenca', async (req, res) => {
  const qrcode = normalizarQRCode(req.body.qrcode);
  const cafe = Boolean(req.body.cafe);
  const almoco = Boolean(req.body.almoco);

  if (!qrcode) {
    return res.status(400).json({ error: 'QR Code não informado.' });
  }

  try {
    const aluno = await prisma.aluno.findUnique({
      where: { qrcode }
    });

    if (!aluno) {
      return res.status(404).json({
        error: 'Aluno não localizado para este QR Code.'
      });
    }

    const agora = new Date();
    const data = agora.toLocaleDateString('pt-BR');
    const hora = agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const historico = await prisma.historico.create({
      data: {
        alunoId: aluno.id,
        nome: aluno.nome,
        turma: aluno.turma,
        fone: aluno.fone,
        qrcode: aluno.qrcode,
        data,
        hora,
        cafe,
        almoco
      }
    });

    return res.json({
      mensagem: 'Entrada registrada com sucesso.',
      historico: {
        ...historico,
        nome: aluno.nome,
        turma: aluno.turma,
        fone: aluno.fone
      }
    });
  } catch (err) {
    console.error('POST /api/presenca:', err);
    res.status(500).json({
      error: 'Erro ao registrar presença.',
      detalhe: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.get('/api/config/foto', async (req, res) => {
  try {
    const config = await prisma.config.findUnique({
      where: { chave: 'foto_logo' }
    });

    res.json({ foto: config?.valor || null });
  } catch (err) {
    console.error('GET /api/config/foto:', err);
    res.status(500).json({ error: 'Erro ao buscar foto.' });
  }
});

app.post('/api/config/foto', async (req, res) => {
  const foto = req.body.foto;

  if (!foto) {
    return res.status(400).json({ error: 'Foto não informada.' });
  }

  try {
    await prisma.config.upsert({
      where: { chave: 'foto_logo' },
      create: { chave: 'foto_logo', valor: foto },
      update: { valor: foto }
    });

    res.json({ mensagem: 'Foto salva com sucesso.' });
  } catch (err) {
    console.error('POST /api/config/foto:', err);
    res.status(500).json({ error: 'Erro ao salvar foto.' });
  }
});

module.exports = app;
