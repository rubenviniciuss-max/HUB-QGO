import logo from "@/assets/logo-qgo.png";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  tamanho = 40,
  comTexto = true,
}: {
  className?: string;
  tamanho?: number;
  comTexto?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logo}
        alt="QGO Prime Contabilidade"
        width={tamanho}
        height={tamanho}
        style={{ width: tamanho, height: tamanho }}
        className="rounded-full object-contain shadow-lg ring-1 ring-primary/40"
      />
      {comTexto && (
        <div className="leading-tight">
          <p className="label-upper text-gold-gradient">QGO PRIME</p>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Contabilidade
          </p>
        </div>
      )}
    </div>
  );
}
