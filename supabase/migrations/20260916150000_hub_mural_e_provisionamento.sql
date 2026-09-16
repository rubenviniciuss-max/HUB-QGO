-- Hub QGO — registra o Mural QGO como ferramenta do ecossistema.
--
-- Fica "ativo = false" de propósito: o Mural ainda não foi publicado no
-- Cloudflare (só roda local por enquanto). Quando publicar, troque a URL e
-- marque "Ativa" na aba "Ferramentas" do próprio Hub — não precisa rodar SQL
-- de novo pra isso.
--
-- Nada aqui mexe em hub_user_tool_access, hub_admins ou nas tabelas de outras
-- ferramentas — isso é só o cadastro do Mural na lista de ferramentas.

insert into public.hub_tools (slug, nome, descricao, url, icone, cor, ordem, ativo, auto_login)
values (
  'mural-qgo',
  'Mural QGO',
  'Mural de avisos da empresa, com tarefas pessoais e notificação por push.',
  'https://SUBSTITUA-PELA-URL-DO-MURAL-QUANDO-PUBLICAR',
  'MessageSquare',
  '#c9a84c',
  5,
  false,
  true
)
on conflict (slug) do nothing;
