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

// Ligar/desligar acesso a uma ferramenta e tornar/remover administrador não
// precisam de server function: a política de segurança (RLS) das tabelas
// hub_user_tool_access e hub_admins já libera escrita direta pra quem é
// admin do hub, então a tela de administração chama o supabase client comum
// (com a sessão do próprio admin) pra isso — ver src/routes/admin.tsx.
