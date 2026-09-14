import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { getToolIcon } from "@/lib/iconMap";
import { abrirFerramenta } from "@/lib/ssoHandoff";
import type { HubTool } from "@/lib/tools";

export function ToolCard({ tool }: { tool: HubTool }) {
  const [abrindo, setAbrindo] = useState(false);
  const Icon = getToolIcon(tool.icone);

  async function handleAbrir() {
    setAbrindo(true);
    try {
      await abrirFerramenta(tool);
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleAbrir()}
      disabled={abrindo}
      className="surface-card group flex flex-col items-start gap-4 p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--glow-gold)] disabled:pointer-events-none disabled:opacity-70"
    >
      <div
        className="flex size-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${tool.cor}22`, color: tool.cor }}
      >
        <Icon className="size-6" />
      </div>

      <div className="flex-1">
        <h3 className="card-title flex items-center gap-1.5">
          {tool.nome}
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </h3>
        {tool.descricao && <p className="mt-1 text-sm text-muted-foreground">{tool.descricao}</p>}
      </div>

      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
        {abrindo ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Abrindo…
          </>
        ) : tool.auto_login ? (
          "Abrir com login automático"
        ) : (
          "Abrir"
        )}
      </span>
    </button>
  );
}
