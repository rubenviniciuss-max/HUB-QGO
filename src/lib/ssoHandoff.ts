import { supabase } from "@/integrations/supabase/client";
import type { HubTool } from "@/lib/tools";

// O "auto-login": Painel Operacional, Portal QGO Prime e Gestão Financeira
// usam o MESMO projeto Supabase deste hub. O cliente Supabase de cada uma
// delas já sabe ler uma sessão colocada na URL (é o mesmo mecanismo usado em
// links de convite/recuperação de senha) — então basta abrir a ferramenta já
// "carregando" o access_token/refresh_token da sessão atual do hub, sem
// mudar uma linha de código nelas.
//
// Vai depois do "#" (fragmento), não como "?" — fragmentos nunca são
// enviados pro servidor (nem aparecem em log nenhum), só são lidos pelo
// navegador/JavaScript da própria página de destino, e a biblioteca do
// Supabase limpa a URL assim que lê.
export async function computarUrlComSessao(tool: Pick<HubTool, "url" | "auto_login">): Promise<string> {
  if (!tool.auto_login) return tool.url;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return tool.url;

  const base = tool.url.replace(/\/+$/, "");
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in ?? 3600),
    token_type: "bearer",
  }).toString();
  return `${base}/#${hash}`;
}

// Abre em nova aba (usado só no link "abrir em nova aba" dentro da tela da
// ferramenta, como alternativa caso o site recuse ser exibido dentro do
// quadro/iframe do hub).
export async function abrirFerramenta(tool: Pick<HubTool, "url" | "auto_login">) {
  const aba = window.open("", "_blank");
  const destino = await computarUrlComSessao(tool);
  if (aba) aba.location.href = destino;
  else window.open(destino, "_blank");
}
