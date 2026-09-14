-- Hub QGO — tabelas próprias deste painel, no MESMO projeto Supabase que já
-- é compartilhado por Painel Operacional, Portal QGO Prime e Gestão
-- Financeira. Não mexe em nenhuma tabela dessas ferramentas.
--
-- Este arquivo precisa ser rodado UMA VEZ no Supabase Studio -> SQL Editor
-- do projeto QGO Prime (o mesmo projeto das outras ferramentas) — assim como
-- os outros arquivos em supabase/migrations/ das demais ferramentas, o
-- Cloudflare só constrói o código do app, ele não roda isso sozinho.

create table if not exists public.hub_tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  descricao text not null default '',
  url text not null,
  icone text not null default 'AppWindow', -- nome de um ícone da biblioteca lucide-react
  cor text not null default '#c9a84c',
  ordem integer not null default 0,
  ativo boolean not null default true,
  -- false para uma ferramenta que não usa este mesmo projeto Supabase (ex.:
  -- Diagnóstico QGO, que hoje só tem uma senha única de admin) — pra essas o
  -- hub apenas mostra o link, sem tentar logar sozinho.
  auto_login boolean not null default true,
  created_at timestamptz not null default now()
);

-- Quem é administrador do Hub (pode gerenciar usuários, ferramentas e
-- permissões). Vazio no início de propósito — o primeiro admin precisa ser
-- inserido manualmente (ver instrução no final deste arquivo).
create table if not exists public.hub_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Permissão simples: usuário X tem acesso à ferramenta Y (existe a linha =
-- tem acesso). Sem granularidade por aba/recurso por enquanto.
create table if not exists public.hub_user_tool_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id uuid not null references public.hub_tools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);

alter table public.hub_tools enable row level security;
alter table public.hub_admins enable row level security;
alter table public.hub_user_tool_access enable row level security;

-- Função auxiliar (security definer) pra checar se um usuário é admin do hub
-- sem cair em referência circular de RLS (a policy de hub_admins também usa
-- ela). Chamada via supabase.rpc('is_hub_admin', { _user_id }) no código.
create or replace function public.is_hub_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.hub_admins a where a.user_id = _user_id
  );
$$;

-- hub_tools: qualquer usuário autenticado pode ver as ferramentas (o hub
-- decide na tela quais mostrar de acordo com o acesso); só admin edita.
drop policy if exists "hub_tools_select_authenticated" on public.hub_tools;
create policy "hub_tools_select_authenticated" on public.hub_tools
  for select to authenticated using (true);

drop policy if exists "hub_tools_write_admin" on public.hub_tools;
create policy "hub_tools_write_admin" on public.hub_tools
  for all to authenticated
  using (public.is_hub_admin(auth.uid()))
  with check (public.is_hub_admin(auth.uid()));

-- hub_admins: só admin lê/escreve (bootstrap do primeiro admin é manual, ver
-- abaixo).
drop policy if exists "hub_admins_all_admin" on public.hub_admins;
create policy "hub_admins_all_admin" on public.hub_admins
  for all to authenticated
  using (public.is_hub_admin(auth.uid()))
  with check (public.is_hub_admin(auth.uid()));

-- hub_user_tool_access: usuário vê as próprias linhas; admin vê e edita tudo.
drop policy if exists "hub_access_select_own_or_admin" on public.hub_user_tool_access;
create policy "hub_access_select_own_or_admin" on public.hub_user_tool_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_hub_admin(auth.uid()));

drop policy if exists "hub_access_write_admin" on public.hub_user_tool_access;
create policy "hub_access_write_admin" on public.hub_user_tool_access
  for all to authenticated
  using (public.is_hub_admin(auth.uid()))
  with check (public.is_hub_admin(auth.uid()));

-- Ferramentas iniciais do ecossistema. "auto_login" = false pro Diagnóstico
-- QGO porque ele não usa este projeto Supabase (só senha única de admin) —
-- ele entra no hub como link normal, sem logar sozinho.
insert into public.hub_tools (slug, nome, descricao, url, icone, cor, ordem, auto_login)
values
  ('painel-operacional', 'Painel Operacional', 'Controle de tarefas dos colaboradores e status fiscal dos clientes.', 'https://painel-operacional-qgo.qgoprime.workers.dev', 'ClipboardList', '#c9a84c', 1, true),
  ('portal-qgo-prime', 'Portal QGO Prime', 'Painel da equipe e portal do cliente: documentos, guias e solicitações.', 'https://portal-qgo-prime.qgoprime.workers.dev', 'Building2', '#c9a84c', 2, true),
  ('gestao-financeira', 'Gestão Financeira', 'Controle financeiro e faturamento dos clientes da QGO.', 'https://gest-o-financeira-qgo.qgoprime.workers.dev', 'Wallet', '#c9a84c', 3, true),
  ('diagnostico-qgo', 'Diagnóstico QGO', 'Autoavaliação/captação de leads (login único de admin, sem conta por usuário).', 'https://SUBSTITUA-PELO-LINK-DO-DIAGNOSTICO', 'Stethoscope', '#c9a84c', 4, false)
on conflict (slug) do nothing;
-- ^ não sei a URL publicada do Diagnóstico QGO — troque esse link na aba
-- "Ferramentas" do próprio Hub depois (ou edite aqui antes de rodar).

-- PASSO MANUAL FINAL (rode só uma vez, trocando o e-mail):
-- Depois de rodar tudo acima, descubra seu próprio user_id e vire o
-- primeiro administrador do Hub (sem isso, ninguém consegue gerenciar nada,
-- porque a tabela hub_admins começa vazia de propósito):
--
--   insert into public.hub_admins (user_id)
--   select id from auth.users where email = 'SEU_EMAIL_AQUI@dominio.com';
