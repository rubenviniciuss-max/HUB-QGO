import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_hub_admin", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores do Hub podem fazer isso.");
}

export type HubUsuario = {
  user_id: string;
  email: string;
  nome: string;
  criado_em: string;
  is_admin: boolean;
  ferramentas: string[]; // ids das ferramentas com acesso
};

// ---------------------------------------------------------------------------
// Provisionamento automático: quando o Hub concede (ou revoga) acesso a uma
// ferramenta, isso cria (ou desativa) a linha de permissão dela mesma, direto
// nas tabelas dessa ferramenta — todas vivem no mesmo projeto Supabase, então
// dá pra escrever nelas com a service role sem precisar chamar a ferramenta
// em si. Depois disso, quem administra CADA ferramenta continua ajustando a
// função/cargo da pessoa por dentro dela (ex.: torná-la admin do Mural,
// promover a admin no Painel Operacional, trocar o tipo no Portal) — o Hub só
// garante que a pessoa já consegue entrar.
//
// Ferramentas sem um "case" aqui só recebem a permissão de abrir o link no
// Hub (hub_user_tool_access) — sem provisionamento extra, até alguém mapear
// o esquema dela também.
// ---------------------------------------------------------------------------
async function provisionarAcessoFerramenta(
  supabaseAdmin: any,
  params: { userId: string; slug: string; nome: string; email: string; conceder: boolean },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { userId, slug, nome, email, conceder } = params;
  try {
    if (slug === "painel-operacional") {
      if (conceder) {
        const { error: roleErr } = await supabaseAdmin
          .from("painel_user_roles")
          .upsert({ user_id: userId, role: "member" }, { onConflict: "user_id,role" });
        if (roleErr) throw roleErr;
        // O role sozinho não basta: o Painel só libera acesso de verdade (e
        // decide as abas visíveis) pela linha em user_permissions. Se a
        // pessoa já tinha uma (ex.: acesso desligado antes), só reativa sem
        // apagar as abas que já estavam configuradas; se é a primeira vez,
        // cria com abas vazias — quem decide o que ela vê é o próprio Painel
        // Operacional, na tela de usuários.
        const { data: existente, error: buscaErro } = await supabaseAdmin
          .from("user_permissions")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (buscaErro) throw buscaErro;
        if (existente) {
          const { error } = await supabaseAdmin.from("user_permissions").update({ ativo: true }).eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from("user_permissions")
            .insert({ user_id: userId, nome, email, tabs: [], ativo: true });
          if (error) throw error;
        }
      } else {
        const { error } = await supabaseAdmin.from("user_permissions").update({ ativo: false }).eq("user_id", userId);
        if (error) throw error;
      }
      return { ok: true };
    }

    if (slug === "portal-qgo-prime") {
      if (conceder) {
        // Só define o "tipo" (função) na criação do perfil — se a pessoa já
        // tinha perfil no Portal (ex.: admin, contador), reativa sem rebaixar.
        const { data: existente, error: buscaErro } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (buscaErro) throw buscaErro;
        if (existente) {
          const { error } = await supabaseAdmin.from("profiles").update({ ativo: true }).eq("id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from("profiles")
            .insert({ id: userId, nome, email, tipo: "operacional", ativo: true });
          if (error) throw error;
        }
      } else {
        const { error } = await supabaseAdmin.from("profiles").update({ ativo: false }).eq("id", userId);
        if (error) throw error;
      }
      return { ok: true };
    }

    if (slug === "gestao-financeira") {
      // A Gestão Financeira NÃO tem conta isolada por pessoa — todo mundo
      // com uma linha em user_roles enxerga os MESMOS clientes/cobranças
      // (é uma tabela de acesso, não um espaço de dados por usuário). Então
      // o provisionamento aqui não "cria uma conta nova": só garante que a
      // pessoa vira staff da ferramenta única, pra entrar direto nos dados
      // de sempre — em vez de logar e não enxergar nada (usuário sem
      // nenhuma linha em user_roles não é staff, e some tudo pra ela).
      if (conceder) {
        const { data: existentes, error: buscaErro } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (buscaErro) throw buscaErro;
        // Se já tem algum papel (ex.: promovida a admin de dentro da própria
        // Gestão Financeira), não mexe — só cria 'user' quando não tem nada.
        if (!existentes || existentes.length === 0) {
          const { error } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: "user" });
          if (error) throw error;
        }
      } else {
        // Não existe coluna "ativo" aqui — o acesso é tudo-ou-nada (existir
        // linha = ser staff), então revogar pelo Hub remove o(s) papel(is).
        const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        if (error) throw error;
      }
      return { ok: true };
    }

    if (slug === "mural-qgo") {
      if (conceder) {
        const { error } = await supabaseAdmin
          .from("mural_usuarios")
          .upsert({ id: userId, nome, ativo: true }, { onConflict: "id" });
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("mural_usuarios").update({ ativo: false }).eq("id", userId);
        if (error) throw error;
      }
      return { ok: true };
    }

    // Ferramenta sem provisionamento mapeado ainda — só o acesso do Hub em si.
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e?.message || `Falha ao sincronizar acesso em "${slug}".` };
  }
}

// Lista só quem é COLABORADOR do Hub (tabela hub_colaboradores) — nunca a
// base inteira de auth.users. O projeto Supabase é compartilhado com o
// Portal QGO Prime, que tem uma conta de login pra cada CLIENTE da
// contabilidade, então listar "todo mundo com login" misturaria cliente com
// colaborador. O Hub é só pra gente de dentro da empresa.
export const adminListUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: colaboradores, error: colabErr } = await supabaseAdmin
      .from("hub_colaboradores")
      .select("user_id");
    if (colabErr) throw new Error(colabErr.message);
    const idsColaboradores = new Set((colaboradores ?? []).map((c: any) => c.user_id));
    if (idsColaboradores.size === 0) return [];

    const { data: userList, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) throw new Error(usersErr.message);

    const { data: admins, error: adminsErr } = await supabaseAdmin.from("hub_admins").select("user_id");
    if (adminsErr) throw new Error(adminsErr.message);
    const adminSet = new Set((admins ?? []).map((a: any) => a.user_id));

    const { data: acessos, error: acessosErr } = await supabaseAdmin
      .from("hub_user_tool_access")
      .select("user_id, tool_id");
    if (acessosErr) throw new Error(acessosErr.message);
    const acessoMap = new Map<string, string[]>();
    for (const a of acessos ?? []) {
      const lista = acessoMap.get(a.user_id) ?? [];
      lista.push(a.tool_id);
      acessoMap.set(a.user_id, lista);
    }

    const usuarios: HubUsuario[] = (userList?.users ?? [])
      .filter((u: any) => idsColaboradores.has(u.id))
      .map((u: any) => ({
        user_id: u.id,
        email: u.email ?? "",
        nome: (u.user_metadata?.nome as string) || "",
        criado_em: u.created_at,
        is_admin: adminSet.has(u.id),
        ferramentas: acessoMap.get(u.id) ?? [],
      }));
    usuarios.sort((a, b) => a.email.localeCompare(b.email));
    return usuarios;
  });

// Confere se já existe uma conta (de QUALQUER ferramenta do ecossistema,
// já que o login é compartilhado) com esse e-mail — sem devolver a lista
// inteira de usuários pro navegador, só a resposta sim/não + o id. Usada
// pela tela de "novo usuário" pra evitar duplicar conta de alguém que já
// loga em outra ferramenta da QGO (ex.: já tem conta no Painel Operacional
// e só precisa ser liberado no Hub também).
export const adminBuscarUsuarioPorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Informe um e-mail.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userList, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    const encontrado = (userList?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (!encontrado) return { existe: false as const };
    return {
      existe: true as const,
      user_id: encontrado.id,
      nome: (encontrado.user_metadata?.nome as string) || "",
    };
  });

// Cria um novo usuário da empresa (mesma base de auth das outras
// ferramentas) já com uma senha provisória. Ninguém precisa confirmar
// e-mail: é uso interno, então a conta já nasce confirmada.
export const adminCriarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; nome: string; senha: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const email = data.email.trim().toLowerCase();
    const nome = data.nome.trim();
    if (!email || !data.senha || data.senha.length < 6) {
      throw new Error("Preencha e-mail, nome e uma senha com pelo menos 6 caracteres.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (error) throw new Error(error.message);
    if (created.user?.id) {
      // Quem é criado pelo Hub é, por definição, colaborador — entra na
      // lista de quem o Hub sabe gerenciar.
      await supabaseAdmin.from("hub_colaboradores").upsert({ user_id: created.user.id });
    }
    return { user_id: created.user?.id };
  });

// Depois que o Hub já garantiu o acesso (conta criada ou já existente, e as
// linhas de hub_user_tool_access já gravadas pela própria tela), isso faz o
// provisionamento cruzado: cria/reativa a permissão da pessoa em cada
// ferramenta marcada, sem duplicar a gravação de hub_user_tool_access (que
// já foi feita direto pelo client, com a sessão do próprio admin).
export const adminProvisionarFerramentas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; nome: string; email: string; tool_ids: string[] }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avisos: string[] = [];
    if (data.tool_ids.length > 0) {
      const { data: tools, error: toolsErr } = await supabaseAdmin
        .from("hub_tools")
        .select("id, slug")
        .in("id", data.tool_ids);
      if (toolsErr) throw new Error(toolsErr.message);
      for (const tool of tools ?? []) {
        const resultado = await provisionarAcessoFerramenta(supabaseAdmin, {
          userId: data.user_id,
          slug: tool.slug,
          nome: data.nome,
          email: data.email,
          conceder: true,
        });
        if (!resultado.ok) avisos.push(resultado.erro);
      }
    }
    return { avisos };
  });

// Liga/desliga o acesso de um usuário existente a uma ferramenta — junto do
// interruptor no Hub, já provisiona (ou desativa) a permissão dela mesma na
// ferramenta de destino.
export const adminDefinirAcessoFerramenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; tool_id: string; conceder: boolean }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tool, error: toolErr } = await supabaseAdmin
      .from("hub_tools")
      .select("slug")
      .eq("id", data.tool_id)
      .maybeSingle();
    if (toolErr) throw new Error(toolErr.message);
    if (!tool) throw new Error("Ferramenta não encontrada.");

    const { data: userInfo, error: userErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (userErr) throw new Error(userErr.message);
    const nome = (userInfo.user?.user_metadata?.nome as string) || "";
    const email = userInfo.user?.email || "";

    if (data.conceder) {
      const { error } = await supabaseAdmin
        .from("hub_user_tool_access")
        .upsert({ user_id: data.user_id, tool_id: data.tool_id });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("hub_user_tool_access")
        .delete()
        .eq("user_id", data.user_id)
        .eq("tool_id", data.tool_id);
      if (error) throw new Error(error.message);
    }

    const resultado = await provisionarAcessoFerramenta(supabaseAdmin, {
      userId: data.user_id,
      slug: tool.slug,
      nome,
      email,
      conceder: data.conceder,
    });
    if (!resultado.ok) throw new Error(resultado.erro);

    return { ok: true };
  });

// Remove o acesso de alguém ao Hub por completo (a conta continua existindo
// nas outras ferramentas — isso só apaga a conta de autenticação se ela não
// tiver sido criada por nenhuma outra ferramenta, mas como todas dividem a
// mesma base, cuidado: isso deleta o login da pessoa em TODO o ecossistema).
export const adminExcluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Tornar/remover administrador do Hub, e remover alguém só do Hub (sem
// mexer no login dela nas outras ferramentas), não precisam de server
// function: a política de segurança (RLS) das tabelas hub_user_tool_access,
// hub_admins e hub_colaboradores já libera escrita direta pra quem é admin
// do hub, então a tela de administração chama o supabase client comum (com
// a sessão do próprio admin) pra isso — ver src/routes/admin.tsx.
