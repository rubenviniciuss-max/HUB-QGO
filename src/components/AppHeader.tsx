import { Link } from "@tanstack/react-router";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function AppHeader() {
  const { session, isAdmin, tema, alternarTema, sair } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="shrink-0">
          <Logo tamanho={36} />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">{session?.user.email}</span>

          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost" size="icon" title="Administração" aria-label="Administração">
                <Settings className="size-4" />
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={alternarTema}
            title={`Trocar para tema ${tema === "dark" ? "claro" : "escuro"}`}
            aria-label="Alternar tema"
          >
            {tema === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => void sair()} title="Sair" aria-label="Sair">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
