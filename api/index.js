const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/api/alunos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alunos ORDER BY nome ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar alunos' });
  }
});

app.post('/api/alunos', async (req, res) => {
  const { nome, turma, fone, qrcode, cafe, almoco } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO alunos (nome, turma, fone, qrcode, cafe, almoco) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nome, turma, fone, qrcode, cafe, almoco]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'QR Code já cadastrado ou dados inválidos' });
  }
});

app.delete('/api/alunos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM alunos WHERE id = $1', [id]);
    res.json({ mensagem: 'Aluno removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar aluno' });
  }
});

app.post('/api/presenca', async (req, res) => {
  const { qrcode, cafe, almoco } = req.body;
  try {
    const alunoRes = await pool.query('SELECT * FROM alunos WHERE qrcode = $1', [qrcode]);
    if (alunoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Aluno não localizado' });
    }
    const aluno = alunoRes.rows[0];

    const presencaRes = await pool.query(
      'INSERT INTO presenca (aluno_id, qrcode, cafe, almoco) VALUES ($1, $2, $3, $4) RETURNING *',
      [aluno.id, qrcode, cafe, almoco]
    );

    res.json({
      mensagem: 'Entrada registrada com sucesso',
      historico: {
        ...presencaRes.rows[0],
        nome: aluno.nome,
        turma: aluno.turma,
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar presença' });
  }
});

app.get('/api/config/foto', async (req, res) => {
  try {
    const result = await pool.query("SELECT valor FROM configuracao WHERE chave = 'foto_logo'");
    res.json({ foto: result.rows[0]?.valor || null });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar foto' });
  }
});

app.post('/api/config/foto', async (req, res) => {
  const { foto } = req.body;
  try {
    await pool.query(
      "INSERT INTO configuracao (chave, valor) VALUES ('foto_logo', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1",
      [foto]
    );
    res.json({ mensagem: 'Foto salva com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar foto' });
  }
});

// Importante para Vercel Serverless
module.exports = app;