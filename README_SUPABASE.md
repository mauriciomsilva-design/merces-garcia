# Mercês Garcia - Vercel + Supabase

## 1. Supabase
No Supabase, abra **SQL Editor** e execute o arquivo `supabase_schema.sql` inteiro.

ATENÇÃO: este script apaga e recria `alunos`, `historico` e `config`. Use apenas se não houver dados que precisam ser preservados.

## 2. Vercel
Configure estas variáveis:

- `SUPABASE_URL` = URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` = chave service_role do Supabase

Marque Production, Preview e Development.

## 3. Teste
Depois do deploy, abra:

`https://SEU-DOMINIO.vercel.app/api/health`

Deve retornar:

`{"ok":true,"banco":"Supabase"}`

## 4. Cadastro
O cadastro envia `qrcode` para `/api/alunos`. O QR existente da carteirinha é salvo em `alunos.qrcode` e não é gerado pelo sistema.
