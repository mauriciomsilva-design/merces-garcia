const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada na Vercel.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function normalizarQRCode(valor) {
  return String(valor ?? '').trim();
}

app.get('/api/health', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('alunos').select('id', { count: 'exact', head: true });
    if (error) throw error;
    res.json({ ok: true, banco: 'Supabase' });
  } catch (err) {
    console.error('GET /api/health:', err);
    res.status(500).json({ ok: false, banco: 'Supabase', error: 'Falha na conexão com o Supabase.', detalhe: err.message });
  }
});

app.get('/api/alunos', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('alunos').select('*').order('nome', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('GET /api/alunos:', err);
    res.status(500).json({ error: 'Erro ao buscar alunos no Supabase.', detalhe: err.message });
  }
});

app.get('/api/historico', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('historico')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('GET /api/historico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico no Supabase.', detalhe: err.message });
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
    return res.status(400).json({ error: 'Nome, turma e QR Code são obrigatórios.' });
  }

  try {
    const supabase = getSupabase();

    const { data: existente, error: buscaError } = await supabase
      .from('alunos')
      .select('id,nome,turma,qrcode')
      .eq('qrcode', qrcode)
      .maybeSingle();

    if (buscaError) throw buscaError;

    if (existente) {
      return res.status(409).json({
        error: `Este QR Code já está vinculado ao aluno ${existente.nome}.`,
        codigo: 'QR_DUPLICADO',
        aluno: existente
      });
    }

    const { data: aluno, error: insertError } = await supabase
      .from('alunos')
      .insert({ nome, turma, fone, qrcode, cafe, almoco })
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'Este QR Code já está cadastrado.', codigo: 'QR_DUPLICADO' });
      }
      throw insertError;
    }

    return res.status(201).json(aluno);
  } catch (err) {
    console.error('POST /api/alunos:', err);
    return res.status(500).json({
      error: 'Não foi possível cadastrar o aluno no Supabase.',
      detalhe: err.message,
      codigo: err.code || null
    });
  }
});

app.delete('/api/alunos/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('alunos').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ mensagem: 'Aluno removido com sucesso.' });
  } catch (err) {
    console.error('DELETE /api/alunos/:id:', err);
    res.status(500).json({ error: 'Erro ao deletar aluno no Supabase.', detalhe: err.message });
  }
});

app.post('/api/presenca', async (req, res) => {
  const qrcode = normalizarQRCode(req.body.qrcode);
  const cafe = Boolean(req.body.cafe);
  const almoco = Boolean(req.body.almoco);

  if (!qrcode) return res.status(400).json({ error: 'QR Code não informado.' });

  try {
    const supabase = getSupabase();
    const { data: aluno, error: alunoError } = await supabase
      .from('alunos').select('*').eq('qrcode', qrcode).maybeSingle();

    if (alunoError) throw alunoError;
    if (!aluno) return res.status(404).json({ error: 'Aluno não localizado para este QR Code.' });

    const agora = new Date();
    const data = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    const { data: historico, error: histError } = await supabase
      .from('historico')
      .insert({ aluno_id: aluno.id, nome: aluno.nome, turma: aluno.turma, fone: aluno.fone, qrcode: aluno.qrcode, data, hora, cafe, almoco })
      .select('*').single();

    if (histError) throw histError;
    res.json({ mensagem: 'Entrada registrada com sucesso.', historico });
  } catch (err) {
    console.error('POST /api/presenca:', err);
    res.status(500).json({ error: 'Erro ao registrar presença no Supabase.', detalhe: err.message });
  }
});

app.get('/api/config/foto', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('config').select('valor').eq('chave', 'foto_logo').maybeSingle();
    if (error) throw error;
    res.json({ foto: data?.valor || null });
  } catch (err) {
    console.error('GET /api/config/foto:', err);
    res.status(500).json({ error: 'Erro ao buscar foto no Supabase.', detalhe: err.message });
  }
});

app.post('/api/config/foto', async (req, res) => {
  const foto = req.body.foto;
  if (!foto) return res.status(400).json({ error: 'Foto não informada.' });

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('config').upsert({ chave: 'foto_logo', valor: foto }, { onConflict: 'chave' });
    if (error) throw error;
    res.json({ mensagem: 'Foto salva com sucesso.' });
  } catch (err) {
    console.error('POST /api/config/foto:', err);
    res.status(500).json({ error: 'Erro ao salvar foto no Supabase.', detalhe: err.message });
  }
});

module.exports = app;
