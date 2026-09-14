import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Tema = "dark" | "light";

interface AuthState {
  session: Session | null;
  carregando: boolean;
  isAdmin: boolean;
  adminCarregando: boolean;
  tema: Tema;
  alternarTema: () => void;
  entrar: (email: string, senha: string) => Promise<{ error: string | null }>;
  sair: () => Promise<void>;
  recuperarSenha: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthState | null>(null);

// Padrão da plataforma é o tema claro, igual às outras ferramentas da QGO —
// só fica escuro se a pessoa escolher isso explicitamente. Guardado no
// navegador (localStorage): o hub não tem uma tabela de perfil própria por
// usuário, então a preferência de tema fica só no aparelho, como já era o
// comportamento das outras ferramentas antes de salvarem no perfil.
const TEMA_STORAGE_KEY = "qgo-hub-tema";

function temaSalvoLocalmente(): Tema {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(TEMA_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function aplicarTema(tema: Tema) {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement;
  raiz.classList.toggle("light", tema === "light");
  raiz.classList.toggle("dark", tema === "dark");
  try {
    window.localStorage.setItem(TEMA_STORAGE_KEY, tema);
  } catch {
    // Navegação privada ou storage bloqueado — segue sem salvar.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCarregando, setAdminCarregando] = useState(true);
  const [tema, setTema] = useState<Tema>(() => temaSalvoLocalmente());

  const checarAdmin = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setIsAdmin(false);
      setAdminCarregando(false);
      return;
    }
    setAdminCarregando(true);
    const { data, error } = await supabase.rpc("is_hub_admin", { _user_id: userId });
    setIsAdmin(!error && !!data);
    setAdminCarregando(false);
  }, []);

  useEffect(() => {
    aplicarTema(tema);
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session ?? null);
      void checarAdmin(data.session?.user.id);
      setCarregando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      if (!ativo) return;
      setSession(novaSessao ?? null);
      void checarAdmin(novaSessao?.user.id);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      return {
        error: error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message,
      };
    }
    return { error: null };
  }, []);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }, []);

  const recuperarSenha = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    return { error: error?.message ?? null };
  }, []);

  const alternarTema = useCallback(() => {
    setTema((atual) => {
      const proximo: Tema = atual === "dark" ? "light" : "dark";
      aplicarTema(proximo);
      return proximo;
    });
  }, []);

  const valor = useMemo<AuthState>(
    () => ({ session, carregando, isAdmin, adminCarregando, tema, alternarTema, entrar, sair, recuperarSenha }),
    [session, carregando, isAdmin, adminCarregando, tema, alternarTema, entrar, sair, recuperarSenha],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
