-- O projeto Supabase é COMPARTILHADO com Portal QGO Prime, que tem conta de
-- CLIENTE pra cada cliente da contabilidade — então "listar todo mundo que
-- tem login" (auth.users) inclui esses clientes também, o que não devia
-- aparecer na tela de usuários do Hub (o Hub é só pra colaborador da
-- empresa). Esta tabela é a "lista de quem é colaborador" própria do Hub:
-- só quem está aqui aparece pra administrar no Hub.
create table if not exists public.hub_colaboradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.hub_colaboradores enable row level security;

drop policy if exists "hub_colaboradores_all_admin" on public.hub_colaboradores;
create policy "hub_colaboradores_all_admin" on public.hub_colaboradores
  for all to authenticated
  using (public.is_hub_admin(auth.uid()))
  with check (public.is_hub_admin(auth.uid()));

-- Marca automaticamente como colaborador qualquer um que já é admin do hub
-- ou que já tinha acesso liberado a alguma ferramenta antes desta tabela
-- existir (senão essas pessoas some da lista do Hub sem querer).
insert into public.hub_colaboradores (user_id)
select user_id from public.hub_admins
union
select user_id from public.hub_user_tool_access
on conflict (user_id) do nothing;
