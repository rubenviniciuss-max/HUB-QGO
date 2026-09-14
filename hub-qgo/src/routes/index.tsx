import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LayoutGrid } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AppHeader } from "@/components/AppHeader";
import { ToolCard } from "@/components/ToolCard";
import { useAuth } from "@/lib/auth";
import { useMinhasFerramentas } from "@/lib/tools";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Hub QGO" }],
  }),
  component: Index,
});

function Index() {
  const { carregando, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (carregando) return;
    if (!session) {
      void navigate({ to: "/login", replace: true });
    }
  }, [carregando, session, navigate]);

  if (carregando || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
        <Logo tamanho={80} comTexto={false} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando o Hub QGO…
        </div>
      </div>
    );
  }

  return <Painel />;
}

function Painel() {
  const { data: ferramentas, isLoading } = useMinhasFerramentas();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="page-title text-gold-gradient">Suas ferramentas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Clique em uma ferramenta para abrir — o login é automático.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando ferramentas…
          </div>
        ) : !ferramentas || ferramentas.length === 0 ? (
          <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
            <LayoutGrid className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma ferramenta liberada para o seu usuário ainda.
              <br />
              Fale com um administrador do Hub.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ferramentas.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
