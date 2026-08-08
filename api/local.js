const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const dir = path.join(process.cwd(), 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, 'merces-garcia.sqlite'));
db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS alunos (id TEXT PRIMARY KEY, nome TEXT NOT NULL, turma TEXT NOT NULL, fone TEXT NOT NULL DEFAULT '', qrcode TEXT NOT NULL UNIQUE, cafe INTEGER NOT NULL DEFAULT 0, almoco INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS historico (id TEXT PRIMARY KEY, aluno_id TEXT NOT NULL, nome TEXT NOT NULL, turma TEXT NOT NULL, fone TEXT NOT NULL DEFAULT '', qrcode TEXT NOT NULL, data TEXT NOT NULL, hora TEXT NOT NULL, cafe INTEGER NOT NULL DEFAULT 0, almoco INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_historico_data ON historico(data);
`);
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const s = v => String(v ?? '').trim();
const b = v => v === true ? 1 : 0;
const out = r => r ? ({ ...r, cafe: !!r.cafe, almoco: !!r.almoco }) : r;

router.get('/health', (req,res) => { try { db.prepare('SELECT 1').get(); res.json({ok:true,banco:'SQLite Local'}); } catch(e) { console.error(e); res.status(500).json({ok:false,banco:'SQLite Local',error:'Falha na conexão com o banco.'}); } });
router.get('/alunos', (req,res) => { try { res.json(db.prepare('SELECT id,nome,turma,fone,qrcode,cafe,almoco FROM alunos ORDER BY nome COLLATE NOCASE').all().map(out)); } catch(e) { console.error(e); res.status(500).json({error:'Erro ao buscar alunos no banco.'}); } });
router.get('/historico', (req,res) => { try { res.json(db.prepare('SELECT id,aluno_id,nome,turma,data,hora,cafe,almoco FROM historico ORDER BY criado_em DESC').all().map(out)); } catch(e) { console.error(e); res.status(500).json({error:'Erro ao buscar histórico no banco.'}); } });

router.post('/alunos', (req,res) => {
  const nome=s(req.body?.nome), turma=s(req.body?.turma), fone=s(req.body?.fone), qrcode=s(req.body?.qrcode), cafe=b(req.body?.cafe), almoco=b(req.body?.almoco);
  if (!nome || nome.length<2 || nome.length>120) return res.status(400).json({error:'Nome deve ter entre 2 e 120 caracteres.'});
  if (!turma || turma.length>60) return res.status(400).json({error:'Turma inválida.'});
  if (fone.length>30) return res.status(400).json({error:'WhatsApp inválido.'});
  if (!qrcode || qrcode.length>200) return res.status(400).json({error:'QR Code inválido.'});
  try {
    const old=db.prepare('SELECT id,nome,turma,qrcode FROM alunos WHERE qrcode=?').get(qrcode);
    if(old) return res.status(409).json({error:`Este QR Code já está vinculado ao aluno ${old.nome}.`,codigo:'QR_DUPLICADO',aluno:old});
    const alunoId=id(); db.prepare('INSERT INTO alunos(id,nome,turma,fone,qrcode,cafe,almoco) VALUES(?,?,?,?,?,?,?)').run(alunoId,nome,turma,fone,qrcode,cafe,almoco);
    res.status(201).json(out(db.prepare('SELECT id,nome,turma,fone,qrcode,cafe,almoco FROM alunos WHERE id=?').get(alunoId)));
  } catch(e) { console.error(e); res.status(500).json({error:'Não foi possível cadastrar o aluno.'}); }
});

router.delete('/alunos/:id',(req,res)=>{ try { const r=db.prepare('DELETE FROM alunos WHERE id=?').run(s(req.params.id)); if(!r.changes) return res.status(404).json({error:'Aluno não encontrado.'}); res.json({mensagem:'Aluno removido com sucesso.'}); } catch(e){ console.error(e); res.status(500).json({error:'Erro ao deletar aluno no banco.'}); } });

router.post('/presenca',(req,res)=>{
  const qrcode=s(req.body?.qrcode), cafe=b(req.body?.cafe), almoco=b(req.body?.almoco);
  if(!qrcode || qrcode.length>200) return res.status(400).json({error:'QR Code inválido.'});
  try {
    const a=db.prepare('SELECT id,nome,turma,fone,qrcode FROM alunos WHERE qrcode=?').get(qrcode);
    if(!a) return res.status(404).json({error:'Aluno não localizado para este QR Code.'});
    const now=new Date(), p=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now).map(x=>[x.type,x.value]));
    const data=`${p.day}/${p.month}/${p.year}`, hora=`${p.hour}:${p.minute}`, hid=id();
    db.prepare('INSERT INTO historico(id,aluno_id,nome,turma,fone,qrcode,data,hora,cafe,almoco) VALUES(?,?,?,?,?,?,?,?,?,?)').run(hid,a.id,a.nome,a.turma,a.fone,a.qrcode,data,hora,cafe,almoco);
    res.json({mensagem:'Entrada registrada com sucesso.',historico:out(db.prepare('SELECT id,aluno_id,nome,turma,data,hora,cafe,almoco FROM historico WHERE id=?').get(hid))});
  } catch(e){ console.error(e); res.status(500).json({error:'Erro ao registrar presença no banco.'}); }
});

router.get('/config/foto',(req,res)=>{ try { const r=db.prepare("SELECT valor FROM config WHERE chave='foto_logo'").get(); res.json({foto:r?.valor||null}); } catch(e){ console.error(e); res.status(500).json({error:'Erro ao buscar a foto no banco.'}); } });
router.post('/config/foto',(req,res)=>{ const foto=typeof req.body?.foto==='string'?req.body.foto.trim():''; if(!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(foto)) return res.status(400).json({error:'Envie uma imagem PNG, JPEG, WEBP ou GIF válida.'}); if(foto.length>2500000) return res.status(413).json({error:'A foto deve ter no máximo 1,8 MB.'}); try { db.prepare('INSERT INTO config(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor').run('foto_logo',foto); res.json({mensagem:'Foto salva com sucesso.'}); } catch(e){ console.error(e); res.status(500).json({error:'Erro ao salvar a foto no banco.'}); } });

module.exports = router;
