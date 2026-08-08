# Mercês Garcia — Vercel + Supabase

## 1. Supabase
Execute **todo** `supabase_schema.sql` no SQL Editor. O script recria as tabelas para eliminar o conflito antigo `uuid/bigint`.

## 2. Vercel
Crie estas variáveis nos três ambientes:

- `SUPABASE_URL` = URL do projeto, por exemplo `https://xxxx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = chave secreta do servidor

Não coloque a service role key no HTML nem no GitHub.

## 3. Deploy
Faça Redeploy na Vercel.

## 4. Teste
Abra `https://SEU-DOMINIO.vercel.app/api/health`. Deve retornar `ok: true` e `banco: Supabase`.

## 5. Cadastro
A aba Alunos permite ler o QR existente da carteirinha e cadastrar o aluno. O primeiro QR é aceito; somente uma segunda tentativa com o mesmo QR retorna `QR_DUPLICADO`.
