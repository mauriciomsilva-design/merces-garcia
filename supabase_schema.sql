-- MERCÊS GARCIA - SUPABASE
-- Execute ESTE arquivo inteiro uma única vez no Supabase > SQL Editor.
-- ATENÇÃO: as três tabelas abaixo pertencem ao sistema. Se já existirem
-- com estrutura antiga, elas serão recriadas para eliminar conflitos UUID/BIGINT.

create extension if not exists pgcrypto;

drop table if exists public.historico cascade;
drop table if exists public.alunos cascade;
drop table if exists public.config cascade;

create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  turma text not null,
  fone text not null default '',
  qrcode text not null unique,
  cafe boolean not null default false,
  almoco boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.historico (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  nome text not null,
  turma text not null,
  fone text not null default '',
  qrcode text not null,
  data text not null,
  hora text not null,
  cafe boolean not null default false,
  almoco boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.config (
  chave text primary key,
  valor text not null default ''
);

create index idx_historico_aluno_id on public.historico(aluno_id);
create index idx_historico_qrcode on public.historico(qrcode);

alter table public.alunos enable row level security;
alter table public.historico enable row level security;
alter table public.config enable row level security;

-- A API da Vercel usa SUPABASE_SERVICE_ROLE_KEY no servidor.
-- Não coloque essa chave no HTML.
