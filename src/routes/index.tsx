import { useEffect, useRef, useState } from "react";
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

// Guarda, por ferramenta, a URL (com sessão) já calculada. Uma vez aberta,
// a ferramenta continua "viva" (o iframe nunca é desmontado) — só fica
// escondida quando você muda pra outra ou volta pro início. É isso que
// mantém a aba/tela em que você estava dentro da ferramenta quando você
// volta pra ela depois.
function Painel() {
  const { data: ferramentas, isLoading } = useMinhasFerramentas();
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Record<string, { tool: HubTool; src: string | null }>>({});
  const calculando = useRef<Set<string>>(new Set());

  function abrir(tool: HubTool) {
    setAtivaId(tool.id);
    setAbertas((atual) => (atual[tool.id] ? atual : { ...atual, [tool.id]: { tool, src: null } }));
  }

  useEffect(() => {
    for (const [id, aberta] of Object.entries(abertas)) {
      if (aberta.src || calculando.current.has(id)) continue;
      calculando.current.add(id);
      void computarUrlComSessao(aberta.tool).then((src) => {
        calculando.current.delete(id);
        setAbertas((atual) => (atual[id] ? { ...atual, [id]: { ...atual[id], src } } : atual));
      });
    }
  }, [abertas]);

  const ativa = ativaId ? (abertas[ativaId]?.tool ?? null) : null;
  const listaAbertas = Object.values(abertas);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar ferramentas={ferramentas ?? []} ativa={ativa} onSelect={(tool) => (tool ? abrir(tool) : setAtivaId(null))} />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className={ativaId ? "hidden" : "flex-1 overflow-y-auto px-4 py-10 sm:px-8"}>
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
                  <ToolCard key={tool.id} tool={tool} onAbrir={() => abrir(tool)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {listaAbertas.map(({ tool, src }) => {
          const visivel = ativaId === tool.id;
          return (
            <div key={tool.id} className={visivel ? "absolute inset-0 flex flex-col" : "hidden"}>
              <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 sm:px-6">
                <h2 className="truncate text-sm font-medium text-foreground">{tool.nome}</h2>
                {src && (
                  <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    Abrir em nova aba <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>

              <div className="relative flex-1">
                {!src ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Carregando {tool.nome}…
                  </div>
                ) : (
                  <iframe src={src} title={tool.nome} className="absolute inset-0 h-full w-full border-0" />
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
