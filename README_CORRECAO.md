# MERCÊS GARCIA — Vercel + Neon

## Esta versão corrige o cadastro do QR Code

O QR Code existente na carteirinha é enviado no campo `qrcode` e fica vinculado ao aluno.

A API não mascara erros do banco como “QR Code já cadastrado”.

## Deploy na Vercel

1. Use esta pasta como raiz do projeto.
2. Configure a variável `DATABASE_URL` na Vercel (Production, Preview e Development, se necessário).
3. Faça um novo deploy.
4. O build executa `prisma generate && prisma db push`, criando/sincronizando as tabelas no Neon.

## Importante

A mensagem “Erro ao cadastrar. Verifique se o QR Code já existe.” NÃO existe nesta versão. Se ela continuar aparecendo, a Vercel ainda está executando um deploy antigo.
