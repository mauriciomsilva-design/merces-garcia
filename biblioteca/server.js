const express = require('express');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = Number(process.env.BIBLIOTECA_PORT || 3001);
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'biblioteca.sqlite'));

db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS livros (
 id TEXT PRIMARY KEY, titulo TEXT NOT NULL, autor TEXT NOT NULL, isbn TEXT DEFAULT '', categoria TEXT DEFAULT '',
 editora TEXT DEFAULT '', ano INTEGER, exemplares INTEGER NOT NULL DEFAULT 1, disponiveis INTEGER NOT NULL DEFAULT 1,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leitores (
 id TEXT PRIMARY KEY, nome TEXT NOT NULL, matricula TEXT DEFAULT '', turma TEXT DEFAULT '', telefone TEXT DEFAULT '',
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS emprestimos (
 id TEXT PRIMARY KEY, livro_id TEXT NOT NULL, leitor_id TEXT NOT NULL, data_emprestimo TEXT NOT NULL,
 data_prevista TEXT NOT NULL, data_devolucao TEXT, status TEXT NOT NULL DEFAULT 'aberto', criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(livro_id) REFERENCES livros(id) ON DELETE RESTRICT,
 FOREIGN KEY(leitor_id) REFERENCES leitores(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos(status);
CREATE INDEX IF NOT EXISTS idx_emprestimos_datas ON emprestimos(data_emprestimo, data_prevista);
`);

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const s = v => String(v ?? '').trim();
const today = () => new Date().toISOString().slice(0,10);
const addDays = (date, days) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+Number(days||0)); return d.toISOString().slice(0,10); };
const safeInt = (v, fallback=0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;

app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req,res)=>{ try { db.prepare('SELECT 1').get(); res.json({ok:true,banco:'SQLite Local',sistema:'Biblioteca'}); } catch(e){ res.status(500).json({ok:false,error:'Banco local indisponível.'}); } });
app.get('/api/dashboard',(req,res)=>{ try { const totalLivros=db.prepare('SELECT COALESCE(SUM(exemplares),0) n FROM livros').get().n; const disponiveis=db.prepare('SELECT COALESCE(SUM(disponiveis),0) n FROM livros').get().n; const leitores=db.prepare('SELECT COUNT(*) n FROM leitores').get().n; const ativos=db.prepare("SELECT COUNT(*) n FROM emprestimos WHERE status='aberto'").get().n; const atrasados=db.prepare("SELECT COUNT(*) n FROM emprestimos WHERE status='aberto' AND data_prevista < date('now','localtime')").get().n; const recentes=db.prepare(`SELECT e.id,e.data_emprestimo,e.data_prevista,e.data_devolucao,e.status,l.titulo,le.nome leitor FROM emprestimos e JOIN livros l ON l.id=e.livro_id JOIN leitores le ON le.id=e.leitor_id ORDER BY e.criado_em DESC LIMIT 8`).all(); res.json({totalLivros,disponiveis,leitores,ativos,atrasados,recentes}); } catch(e){ console.error(e); res.status(500).json({error:'Erro ao carregar painel.'}); } });
app.get('/api/livros',(req,res)=>{ try { const q=s(req.query.q); const rows=q ? db.prepare(`SELECT * FROM livros WHERE titulo LIKE ? OR autor LIKE ? OR isbn LIKE ? OR categoria LIKE ? ORDER BY titulo COLLATE NOCASE`).all(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) : db.prepare('SELECT * FROM livros ORDER BY titulo COLLATE NOCASE').all(); res.json(rows); } catch(e){ res.status(500).json({error:'Erro ao buscar livros.'}); } });
app.post('/api/livros',(req,res)=>{ const titulo=s(req.body?.titulo), autor=s(req.body?.autor), isbn=s(req.body?.isbn), categoria=s(req.body?.categoria), editora=s(req.body?.editora), ano=safeInt(req.body?.ano,0), exemplares=Math.max(1,safeInt(req.body?.exemplares,1)); if(!titulo || !autor) return res.status(400).json({error:'Título e autor são obrigatórios.'}); try { const novo=id(); db.prepare('INSERT INTO livros(id,titulo,autor,isbn,categoria,editora,ano,exemplares,disponiveis) VALUES(?,?,?,?,?,?,?,?,?)').run(novo,titulo,autor,isbn,categoria,editora,ano||null,exemplares,exemplares); res.status(201).json(db.prepare('SELECT * FROM livros WHERE id=?').get(novo)); } catch(e){ console.error(e); res.status(500).json({error:'Não foi possível cadastrar o livro.'}); } });
app.put('/api/livros/:id',(req,res)=>{ const idLivro=s(req.params.id); try { const atual=db.prepare('SELECT * FROM livros WHERE id=?').get(idLivro); if(!atual) return res.status(404).json({error:'Livro não encontrado.'}); const titulo=s(req.body?.titulo)||atual.titulo, autor=s(req.body?.autor)||atual.autor, categoria=s(req.body?.categoria), isbn=s(req.body?.isbn), editora=s(req.body?.editora), ano=safeInt(req.body?.ano,0)||null, ex=Math.max(atual.exemplares,safeInt(req.body?.exemplares,atual.exemplares)); const delta=ex-atual.exemplares; db.prepare('UPDATE livros SET titulo=?,autor=?,isbn=?,categoria=?,editora=?,ano=?,exemplares=?,disponiveis=? WHERE id=?').run(titulo,autor,isbn,categoria,editora,ano,ex,atual.disponiveis+delta,idLivro); res.json(db.prepare('SELECT * FROM livros WHERE id=?').get(idLivro)); } catch(e){ console.error(e); res.status(500).json({error:'Não foi possível atualizar o livro.'}); } });
app.delete('/api/livros/:id',(req,res)=>{ try { const r=db.prepare('DELETE FROM livros WHERE id=?').run(s(req.params.id)); if(!r.changes) return res.status(404).json({error:'Livro não encontrado.'}); res.json({mensagem:'Livro removido.'}); } catch(e){ res.status(409).json({error:'Este livro possui histórico de empréstimos e não pode ser removido.'}); } });
app.get('/api/leitores',(req,res)=>{ try { const q=s(req.query.q); const rows=q ? db.prepare(`SELECT * FROM leitores WHERE nome LIKE ? OR matricula LIKE ? OR turma LIKE ? ORDER BY nome COLLATE NOCASE`).all(`%${q}%`,`%${q}%`,`%${q}%`) : db.prepare('SELECT * FROM leitores ORDER BY nome COLLATE NOCASE').all(); res.json(rows); } catch(e){ res.status(500).json({error:'Erro ao buscar leitores.'}); } });
app.post('/api/leitores',(req,res)=>{ const nome=s(req.body?.nome), matricula=s(req.body?.matricula), turma=s(req.body?.turma), telefone=s(req.body?.telefone); if(!nome) return res.status(400).json({error:'Nome é obrigatório.'}); try { const novo=id(); db.prepare('INSERT INTO leitores(id,nome,matricula,turma,telefone) VALUES(?,?,?,?,?)').run(novo,nome,matricula,turma,telefone); res.status(201).json(db.prepare('SELECT * FROM leitores WHERE id=?').get(novo)); } catch(e){ res.status(500).json({error:'Não foi possível cadastrar o leitor.'}); } });
app.delete('/api/leitores/:id',(req,res)=>{ try { const r=db.prepare('DELETE FROM leitores WHERE id=?').run(s(req.params.id)); if(!r.changes) return res.status(404).json({error:'Leitor não encontrado.'}); res.json({mensagem:'Leitor removido.'}); } catch(e){ res.status(409).json({error:'Este leitor possui histórico de empréstimos e não pode ser removido.'}); } });
app.get('/api/emprestimos',(req,res)=>{ try { const status=s(req.query.status); const base=`SELECT e.*,l.titulo,l.autor,le.nome leitor,le.matricula,le.turma FROM emprestimos e JOIN livros l ON l.id=e.livro_id JOIN leitores le ON le.id=e.leitor_id`; const rows=status ? db.prepare(`${base} WHERE e.status=? ORDER BY e.criado_em DESC`).all(status) : db.prepare(`${base} ORDER BY e.criado_em DESC`).all(); res.json(rows); } catch(e){ res.status(500).json({error:'Erro ao buscar empréstimos.'}); } });
app.post('/api/emprestimos',(req,res)=>{ const livro_id=s(req.body?.livro_id), leitor_id=s(req.body?.leitor_id), dias=Math.max(1,Math.min(90,safeInt(req.body?.dias,7))); if(!livro_id || !leitor_id) return res.status(400).json({error:'Selecione livro e leitor.'}); try { const l=db.prepare('SELECT * FROM livros WHERE id=?').get(livro_id); if(!l) return res.status(404).json({error:'Livro não encontrado.'}); if(l.disponiveis<1) return res.status(409).json({error:'Não há exemplar disponível deste livro.'}); const le=db.prepare('SELECT * FROM leitores WHERE id=?').get(leitor_id); if(!le) return res.status(404).json({error:'Leitor não encontrado.'}); const eid=id(), data=today(), prevista=addDays(data,dias); db.exec('BEGIN'); db.prepare('INSERT INTO emprestimos(id,livro_id,leitor_id,data_emprestimo,data_prevista,status) VALUES(?,?,?,?,?,\'aberto\')').run(eid,livro_id,leitor_id,data,prevista); db.prepare('UPDATE livros SET disponiveis=disponiveis-1 WHERE id=?').run(livro_id); db.exec('COMMIT'); res.status(201).json({mensagem:'Empréstimo registrado.',id:eid,data_prevista:prevista}); } catch(e){ try{db.exec('ROLLBACK')}catch{} console.error(e); res.status(500).json({error:'Não foi possível registrar o empréstimo.'}); } });
app.post('/api/emprestimos/:id/devolver',(req,res)=>{ try { const e=db.prepare("SELECT * FROM emprestimos WHERE id=? AND status='aberto'").get(s(req.params.id)); if(!e) return res.status(404).json({error:'Empréstimo aberto não encontrado.'}); db.exec('BEGIN'); db.prepare("UPDATE emprestimos SET status='devolvido',data_devolucao=? WHERE id=?").run(today(),e.id); db.prepare('UPDATE livros SET disponiveis=disponiveis+1 WHERE id=?').run(e.livro_id); db.exec('COMMIT'); res.json({mensagem:'Livro devolvido com sucesso.'}); } catch(err){ try{db.exec('ROLLBACK')}catch{} res.status(500).json({error:'Não foi possível registrar a devolução.'}); } });
app.get('/api/relatorios/resumo',(req,res)=>{ try { const porCategoria=db.prepare(`SELECT COALESCE(NULLIF(categoria,''),'Sem categoria') categoria, COUNT(*) titulos, SUM(exemplares) exemplares, SUM(disponiveis) disponiveis FROM livros GROUP BY categoria ORDER BY exemplares DESC`).all(); const maisEmprestados=db.prepare(`SELECT l.titulo,l.autor,COUNT(e.id) total FROM livros l LEFT JOIN emprestimos e ON e.livro_id=l.id GROUP BY l.id ORDER BY total DESC,l.titulo LIMIT 10`).all(); res.json({porCategoria,maisEmprestados}); } catch(e){ res.status(500).json({error:'Erro nos relatórios.'}); } });

// A página inovadora é a página principal da biblioteca.
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index-inovador.html')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index-inovador.html')));
app.listen(PORT,'127.0.0.1',()=>console.log(`Biblioteca local: http://localhost:${PORT}`));
