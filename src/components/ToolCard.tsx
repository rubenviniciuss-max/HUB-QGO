import { ArrowUpRight } from "lucide-react";
import { getToolIcon } from "@/lib/iconMap";
import type { HubTool } from "@/lib/tools";

export function ToolCard({ tool, onAbrir }: { tool: HubTool; onAbrir: () => void }) {
  const Icon = getToolIcon(tool.icone);

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="surface-card group flex flex-col items-start gap-4 p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--glow-gold)]"
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

      <span className="text-xs font-medium text-primary">
        {tool.auto_login ? "Abrir com login automático" : "Abrir"}
      </span>
    </button>
  );
}
