import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Entrar | Hub QGO" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { entrar, recuperarSenha, session, carregando } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [modoRecuperar, setModoRecuperar] = useState(false);

  useEffect(() => {
    if (carregando || !session) return;
    void navigate({ to: "/", replace: true });
  }, [carregando, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || (!modoRecuperar && !senha)) {
      toast.error("Informe seus dados de acesso.");
      return;
    }
    setEnviando(true);
    if (modoRecuperar) {
      const { error } = await recuperarSenha(email);
      setEnviando(false);
      if (error) toast.error(error);
      else {
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
        setModoRecuperar(false);
      }
      return;
    }
    const { error } = await entrar(email, senha);
    setEnviando(false);
    if (error) toast.error(error);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo tamanho={92} comTexto={false} />
          <h1 className="mt-5 page-title text-gold-gradient">Hub QGO</h1>
          <p className="mt-2 text-sm text-muted-foreground">Todas as ferramentas do ecossistema, em um só lugar</p>
        </div>

        <div className="surface-card p-7">
          <h2 className="card-title">{modoRecuperar ? "Recuperar acesso" : "Entrar"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {modoRecuperar
              ? "Informe seu e-mail para receber o link de redefinição."
              : "Use o mesmo e-mail e senha das outras ferramentas da QGO."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com.br"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {!modoRecuperar && (
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={enviando}
              className="w-full bg-gold-gradient font-medium text-primary-foreground hover:opacity-90"
            >
              {enviando && <Loader2 className="mr-2 size-4 animate-spin" />}
              {modoRecuperar ? "Enviar link" : "Entrar"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setModoRecuperar((v) => !v)}
            className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {modoRecuperar ? "Voltar para o login" : "Esqueci minha senha"}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} QGO Prime. Acesso restrito à equipe.
        </p>
      </div>
    </div>
  );
}
