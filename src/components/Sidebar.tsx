import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Home, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getToolIcon } from "@/lib/iconMap";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { HubTool } from "@/lib/tools";

// Preferência de cada pessoa (recolher o menu) fica salva no navegador dela —
// assim continua do jeito que ela deixou mesmo depois de atualizar a página.
const RECOLHIDA_STORAGE_KEY = "qgo-hub-menu-recolhido";

export function Sidebar({
  ferramentas,
  ativa,
  onSelect,
}: {
  ferramentas: HubTool[];
  ativa: HubTool | null;
  onSelect: (tool: HubTool | null) => void;
}) {
  const { session, isAdmin, tema, alternarTema, sair } = useAuth();
  const [recolhida, setRecolhida] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(RECOLHIDA_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  function alternarRecolhida() {
    setRecolhida((atual) => {
      const proximo = !atual;
      try {
        window.localStorage.setItem(RECOLHIDA_STORAGE_KEY, proximo ? "1" : "0");
      } catch {
        // Navegação privada ou storage bloqueado — segue sem salvar.
      }
      return proximo;
    });
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150",
        recolhida ? "w-[64px]" : "w-64",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-4">
        <Logo tamanho={30} comTexto={!recolhida} />
        <button
          type="button"
          onClick={alternarRecolhida}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
        >
          {recolhida ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          title="Início"
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            !ativa ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted",
          )}
        >
          <Home className="size-4 shrink-0" />
          {!recolhida && "Início"}
        </button>

        {ferramentas.length > 0 && (
          <div className="mt-5">
            {!recolhida && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ferramentas
              </p>
            )}
            <div className="mt-1.5 space-y-0.5">
              {ferramentas.map((t) => {
                const Icon = getToolIcon(t.icone);
                const isAtiva = ativa?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t)}
                    title={t.nome}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isAtiva ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4 shrink-0" style={{ color: isAtiva ? undefined : t.cor }} />
                    {!recolhida && <span className="truncate">{t.nome}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="mt-5">
            {!recolhida && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administração
              </p>
            )}
            <div className="mt-1.5">
              <Link
                to="/admin"
                title="Gerenciar"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Settings className="size-4 shrink-0" />
                {!recolhida && "Gerenciar"}
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        {!recolhida && (
          <p className="mb-2 truncate text-xs text-muted-foreground" title={session?.user.email}>
            {session?.user.email}
          </p>
        )}
        <div className={cn("flex gap-1", recolhida && "flex-col")}>
          <button
            type="button"
            onClick={alternarTema}
            title={`Trocar para tema ${tema === "dark" ? "claro" : "escuro"}`}
            className="flex-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {tema === "dark" ? <Sun className="mx-auto size-4" /> : <Moon className="mx-auto size-4" />}
          </button>
          <button
            type="button"
            onClick={() => void sair()}
            title="Sair"
            className="flex-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="mx-auto size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
