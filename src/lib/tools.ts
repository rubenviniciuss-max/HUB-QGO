import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

export type HubTool = Database["public"]["Tables"]["hub_tools"]["Row"];

// Usada na tela de administração: todas as ferramentas cadastradas, ativas
// ou não (RLS permite qualquer autenticado ler, então funciona pra qualquer
// usuário — a tela de admin em si é que fica escondida de quem não é admin).
export function useTodasFerramentas() {
  return useQuery({
    queryKey: ["hub-tools-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hub_tools").select("*").order("ordem", { ascending: true });
      if (error) throw error;
      return data as HubTool[];
    },
  });
}

// Usada no painel principal: só as ferramentas ativas que o usuário logado
// pode abrir (admin vê todas as ativas automaticamente).
export function useMinhasFerramentas() {
  const { session, isAdmin, adminCarregando } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["hub-my-tools", userId, isAdmin],
    enabled: !!userId && !adminCarregando,
    queryFn: async () => {
      const { data: tools, error } = await supabase
        .from("hub_tools")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;

      if (isAdmin) return tools as HubTool[];

      const { data: acessos, error: acessosErro } = await supabase
        .from("hub_user_tool_access")
        .select("tool_id")
        .eq("user_id", userId as string);
      if (acessosErro) throw acessosErro;
      const permitido = new Set((acessos ?? []).map((a) => a.tool_id));
      return (tools as HubTool[]).filter((t) => permitido.has(t.id));
    },
  });
}
