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
// Ferramentas sem um "case" aqui (ex.: Gestão Financeira, por enquanto) só
// recebem a permissão de abrir o link no Hub (hub_user_tool_access) — sem
// provisionamento extra, até alguém mapear o esquema dela também.
// ---------------------------------------------------------------------------
async function provisionarAcessoFerramenta(
  supabaseAdmin: any,
  params: { userId: string; slug: string; nome: string; email: string; conceder: boolean },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { userId, slug, nome, email, conceder } = params;
  try {
    if (slug === "painel-operacional") {
      if (conceder) {
        const { error } = await supabaseAdmin
          .from("painel_user_roles")
          .upsert({ user_id: userId, role: "member" }, { onConflict: "user_id,role" });
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from("painel_user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "member");
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

// Lista todo mundo que já tem conta no projeto Supabase compartilhado (a
// mesma base de usuários das outras ferramentas da QGO), cruzando com quem é
// admin do hub e quais ferramentas cada um pode abrir.
export const adminListUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const usuarios: HubUsuario[] = (userList?.users ?? []).map((u: any) => ({
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

// Cria um novo usuário da empresa (mesma base de auth das outras
// ferramentas) já com uma senha provisória, e já libera (Hub + provisionamento
// automático) as ferramentas marcadas na tela de criação.
export const adminCriarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; nome: string; senha: string; toolIds?: string[] }) => data)
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
    const userId = created.user?.id;
    if (!userId) throw new Error("Usuário criado, mas sem id retornado — avise o suporte.");

    const toolIds = data.toolIds ?? [];
    const avisos: string[] = [];
    if (toolIds.length > 0) {
      const { data: tools, error: toolsErr } = await supabaseAdmin
        .from("hub_tools")
        .select("id, slug")
        .in("id", toolIds);
      if (toolsErr) throw new Error(toolsErr.message);

      for (const tool of tools ?? []) {
        const { error: acessoErr } = await supabaseAdmin
          .from("hub_user_tool_access")
          .upsert({ user_id: userId, tool_id: tool.id });
        if (acessoErr) {
          avisos.push(`Não deu pra liberar "${tool.slug}" no Hub: ${acessoErr.message}`);
          continue;
        }
        const resultado = await provisionarAcessoFerramenta(supabaseAdmin, {
          userId,
          slug: tool.slug,
          nome,
          email,
          conceder: true,
        });
        if (!resultado.ok) avisos.push(resultado.erro);
      }
    }

    return { user_id: userId, avisos };
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

// Tornar/remover administrador do Hub não precisa de server function: a
// política de segurança (RLS) de hub_admins já libera escrita direta pra quem
// já é admin do hub, então a tela de administração chama o supabase client
// comum (com a sessão do próprio admin) pra isso — ver src/routes/admin.tsx.
