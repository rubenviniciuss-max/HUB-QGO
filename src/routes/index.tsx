import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Loader2, LayoutGrid } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/Sidebar";
import { ToolCard } from "@/components/ToolCard";
import { useAuth } from "@/lib/auth";
import { useMinhasFerramentas } from "@/lib/tools";
import { computarUrlComSessao } from "@/lib/ssoHandoff";
import type { HubTool } from "@/lib/tools";

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
  const [ativa, setAtiva] = useState<HubTool | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!ativa) {
      setIframeSrc(null);
      return;
    }
    let cancelado = false;
    setIframeSrc(null);
    void computarUrlComSessao(ativa).then((url) => {
      if (!cancelado) setIframeSrc(url);
    });
    return () => {
      cancelado = true;
    };
  }, [ativa]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar ferramentas={ferramentas ?? []} ativa={ativa} onSelect={setAtiva} />

      <main className="flex flex-1 flex-col overflow-hidden">
        {!ativa ? (
          <div className="flex-1 overflow-y-auto px-4 py-10 sm:px-8">
            <div className="mx-auto max-w-6xl">
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
                    <ToolCard key={tool.id} tool={tool} onAbrir={() => setAtiva(tool)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 sm:px-6">
              <h2 className="truncate text-sm font-medium text-foreground">{ativa.nome}</h2>
              {iframeSrc && (
                <a
                  href={iframeSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Abrir em nova aba <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>

            <div className="relative flex-1">
              {!iframeSrc ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Carregando {ativa.nome}…
                </div>
              ) : (
                <iframe
                  key={ativa.id}
                  src={iframeSrc}
                  title={ativa.nome}
                  className="absolute inset-0 h-full w-full border-0"
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
