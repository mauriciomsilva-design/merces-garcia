const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const PRODUCTION_ORIGIN = process.env.APP_ORIGIN || 'https://merces-garcia.vercel.app';
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

app.disable('x-powered-by');

app.use(cors({
  origin(origin, callback) {
    // Non-browser requests have no Origin header. CORS does not protect the API
    // by itself; write routes below additionally enforce same-origin requests.
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '3mb', strict: true }));

// Basic security headers for the serverless function.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  next();
});

// Small per-instance rate limiter. Vercel Functions are ephemeral, so this is
// intentionally a defense-in-depth layer, not a replacement for Vercel/WAF limits.
const rateBuckets = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;

function rateLimit(req, res, next) {
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return next();
  }

  current.count += 1;
  if (current.count > RATE_MAX) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
  }

  return next();
}

app.use(rateLimit);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error('Supabase environment is not configured');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function normalizarQRCode(valor) {
  return String(valor ?? '').trim();
}

function asBoolean(value) {
  return value === true;
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) return ALLOWED_ORIGINS.has(origin);
  if (referer) {
    try {
      return ALLOWED_ORIGINS.has(new URL(referer).origin);
    } catch (_) {
      return false;
    }
  }

  return false;
}

function requireSameOrigin(req, res, next) {
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Origem da requisição não autorizada.' });
  }
  return next();
}

function validateAluno({ nome, turma, fone, qrcode }) {
  if (!nome || nome.length < 2 || nome.length > 120) return 'Nome deve ter entre 2 e 120 caracteres.';
  if (!turma || turma.length > 60) return 'Turma inválida.';
  if (fone.length > 30) return 'WhatsApp inválido.';
  if (!qrcode || qrcode.length > 200) return 'QR Code inválido.';
  return null;
}

function logError(route, err) {
  console.error(`${route}:`, {
    message: err?.message,
    code: err?.code,
    status: err?.status,
    details: err?.details
  });
}

app.get('/api/health', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('alunos').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return res.json({ ok: true, banco: 'Supabase' });
  } catch (err) {
    logError('GET /api/health', err);
    return res.status(500).json({ ok: false, banco: 'Supabase', error: 'Falha na conexão com o banco.' });
  }
});

app.get('/api/alunos', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('alunos')
      .select('id,nome,turma,fone,qrcode,cafe,almoco')
      .order('nome', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    logError('GET /api/alunos', err);
    return res.status(500).json({ error: 'Erro ao buscar alunos no banco.' });
  }
});

app.get('/api/historico', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('historico')
      .select('id,aluno_id,nome,turma,data,hora,cafe,almoco')
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    logError('GET /api/historico', err);
    return res.status(500).json({ error: 'Erro ao buscar histórico no banco.' });
  }
});

app.post('/api/alunos', requireSameOrigin, async (req, res) => {
  const nome = String(req.body?.nome ?? '').trim();
  const turma = String(req.body?.turma ?? '').trim();
  const fone = String(req.body?.fone ?? '').trim();
  const qrcode = normalizarQRCode(req.body?.qrcode);
  const cafe = asBoolean(req.body?.cafe);
  const almoco = asBoolean(req.body?.almoco);

  const validationError = validateAluno({ nome, turma, fone, qrcode });
  if (validationError) return res.status(400).json({ error: validationError });

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
      .select('id,nome,turma,fone,qrcode,cafe,almoco')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'Este QR Code já está cadastrado.', codigo: 'QR_DUPLICADO' });
      }
      throw insertError;
    }

    return res.status(201).json(aluno);
  } catch (err) {
    logError('POST /api/alunos', err);
    return res.status(500).json({ error: 'Não foi possível cadastrar o aluno.' });
  }
});

app.delete('/api/alunos/:id', requireSameOrigin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id || id.length > 100 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Identificador de aluno inválido.' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('alunos')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Aluno não encontrado.' });

    return res.json({ mensagem: 'Aluno removido com sucesso.' });
  } catch (err) {
    logError('DELETE /api/alunos/:id', err);
    return res.status(500).json({ error: 'Erro ao deletar aluno no banco.' });
  }
});

app.post('/api/presenca', requireSameOrigin, async (req, res) => {
  const qrcode = normalizarQRCode(req.body?.qrcode);
  const cafe = asBoolean(req.body?.cafe);
  const almoco = asBoolean(req.body?.almoco);

  if (!qrcode || qrcode.length > 200) {
    return res.status(400).json({ error: 'QR Code inválido.' });
  }

  try {
    const supabase = getSupabase();
    const { data: aluno, error: alunoError } = await supabase
      .from('alunos')
      .select('id,nome,turma,fone,qrcode')
      .eq('qrcode', qrcode)
      .maybeSingle();

    if (alunoError) throw alunoError;
    if (!aluno) return res.status(404).json({ error: 'Aluno não localizado para este QR Code.' });

    const agora = new Date();
    const data = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const hora = agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });

    const { data: historico, error: histError } = await supabase
      .from('historico')
      .insert({
        aluno_id: aluno.id,
        nome: aluno.nome,
        turma: aluno.turma,
        fone: aluno.fone,
        qrcode: aluno.qrcode,
        data,
        hora,
        cafe,
        almoco
      })
      .select('id,aluno_id,nome,turma,data,hora,cafe,almoco')
      .single();

    if (histError) throw histError;
    return res.json({ mensagem: 'Entrada registrada com sucesso.', historico });
  } catch (err) {
    logError('POST /api/presenca', err);
    return res.status(500).json({ error: 'Erro ao registrar presença no banco.' });
  }
});

app.get('/api/config/foto', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('config')
      .select('valor')
      .eq('chave', 'foto_logo')
      .maybeSingle();

    if (error) throw error;
    return res.json({ foto: data?.valor || null });
  } catch (err) {
    logError('GET /api/config/foto', err);
    return res.status(500).json({ error: 'Erro ao buscar a foto no banco.' });
  }
});

app.post('/api/config/foto', requireSameOrigin, async (req, res) => {
  const foto = typeof req.body?.foto === 'string' ? req.body.foto.trim() : '';

  // Keep the logo as a small data URL. This prevents oversized payloads and
  // avoids accepting arbitrary HTML/script content as a stored value.
  const match = foto.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return res.status(400).json({ error: 'Envie uma imagem PNG, JPEG, WEBP ou GIF válida.' });
  if (foto.length > 2_500_000) return res.status(413).json({ error: 'A foto deve ter no máximo 1,8 MB.' });

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('config')
      .upsert({ chave: 'foto_logo', valor: foto }, { onConflict: 'chave' });

    if (error) throw error;
    return res.json({ mensagem: 'Foto salva com sucesso.' });
  } catch (err) {
    logError('POST /api/config/foto', err);
    return res.status(500).json({ error: 'Erro ao salvar a foto no banco.' });
  }
});

module.exports = app;
