-- BANCO SUPABASE - MERCÊS GARCIA
-- IMPORTANTE: este script apaga as tabelas antigas deste projeto e recria tudo do zero.
-- Use somente se o banco Supabase ainda não possui dados que você precisa preservar.

create extension if not exists pgcrypto;

-- Remove tabelas antigas/incompatíveis (inclusive as que ficaram com id bigint).
drop table if exists public.historico cascade;
drop table if exists public.alunos cascade;
drop table if exists public.config cascade;

-- Alunos: UUID como chave primária.
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

-- Histórico: aluno_id usa EXATAMENTE o mesmo tipo UUID de alunos.id.
create table public.historico (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references public.alunos(id) on delete set null,
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
create index idx_alunos_qrcode on public.alunos(qrcode);

-- A API usa SUPABASE_SERVICE_ROLE_KEY no servidor.
-- RLS permanece habilitado; a service_role consegue operar no backend.
alter table public.alunos enable row level security;
alter table public.historico enable row level security;
alter table public.config enable row level security;

select 'Banco Supabase criado corretamente.' as resultado;
