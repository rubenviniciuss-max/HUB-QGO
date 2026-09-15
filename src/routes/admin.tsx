import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Shield, ShieldOff, Trash2, Pencil } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getToolIcon } from "@/lib/iconMap";
import { useTodasFerramentas, type HubTool } from "@/lib/tools";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  adminBuscarUsuarioPorEmail,
  adminCriarUsuario,
  adminListUsuarios,
  type HubUsuario,
} from "@/lib/hub.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Administração | Hub QGO" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { carregando, session, isAdmin, adminCarregando } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (carregando || adminCarregando) return;
    if (!session) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (!isAdmin) {
      void navigate({ to: "/", replace: true });
    }
  }, [carregando, adminCarregando, session, isAdmin, navigate]);

  if (carregando || adminCarregando || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="page-title text-gold-gradient">Administração</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gerencie quem tem acesso ao Hub e quais ferramentas cada pessoa pode abrir.
        </p>

        <Tabs defaultValue="usuarios" className="mt-8">
          <TabsList>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>
          </TabsList>
          <TabsContent value="usuarios" className="mt-6">
            <UsuariosTab />
          </TabsContent>
          <TabsContent value="ferramentas" className="mt-6">
            <FerramentasTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usuários: lista todo mundo com conta no ecossistema QGO, com um botão por
// ferramenta pra liberar/tirar acesso, e uma chave pra torná-lo admin do hub.
// ---------------------------------------------------------------------------

function UsuariosTab() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const listUsuariosFn = useServerFn(adminListUsuarios);
  const criarUsuarioFn = useServerFn(adminCriarUsuario);
  const buscarPorEmailFn = useServerFn(adminBuscarUsuarioPorEmail);

  const { data: ferramentas } = useTodasFerramentas();
  const usuariosQ = useQuery({
    queryKey: ["hub-admin-usuarios"],
    queryFn: async () => listUsuariosFn(),
  });

  const [novoOpen, setNovoOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ferramentasNovoUsuario, setFerramentasNovoUsuario] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // "novo" -> ninguém com esse e-mail no ecossistema, vai criar conta.
  // "existente" -> já tem conta em alguma ferramenta da QGO (ex.: Painel
  // Operacional) — só libera o Hub pra ela, sem duplicar conta/senha.
  const [statusEmail, setStatusEmail] = useState<"digitando" | "verificando" | "novo" | "existente">("digitando");
  const [existenteId, setExistenteId] = useState<string | null>(null);

  function alternarFerramentaNovoUsuario(toolId: string, marcado: boolean) {
    setFerramentasNovoUsuario((atual) =>
      marcado ? [...atual, toolId] : atual.filter((id) => id !== toolId),
    );
  }

  function resetarFormNovo() {
    setNome("");
    setEmail("");
    setSenha("");
    setFerramentasNovoUsuario([]);
    setStatusEmail("digitando");
    setExistenteId(null);
  }

  async function verificarEmail() {
    const valor = email.trim();
    if (!valor || !valor.includes("@")) return;
    setStatusEmail("verificando");
    try {
      const resultado = await buscarPorEmailFn({ data: { email: valor } });
      if (resultado.existe) {
        setStatusEmail("existente");
        setExistenteId(resultado.user_id);
        if (resultado.nome) setNome(resultado.nome);
      } else {
        setStatusEmail("novo");
        setExistenteId(null);
      }
    } catch (e: any) {
      setStatusEmail("digitando");
      toast.error(e?.message || "Não foi possível checar o e-mail.");
    }
  }

  async function handleCriar() {
    if (!email.trim()) {
      toast.error("Preencha o e-mail.");
      return;
    }
    if (statusEmail === "existente" && existenteId) {
      setSalvando(true);
      try {
        const { error: colabErr } = await supabase.from("hub_colaboradores").upsert({ user_id: existenteId });
        if (colabErr) throw new Error(colabErr.message);
        if (ferramentasNovoUsuario.length > 0) {
          const { error } = await supabase
            .from("hub_user_tool_access")
            .upsert(ferramentasNovoUsuario.map((tool_id) => ({ user_id: existenteId, tool_id })));
          if (error) throw new Error(error.message);
        }
        toast.success("Acesso ao Hub liberado — essa pessoa já tinha conta em outra ferramenta da QGO.");
        setNovoOpen(false);
        resetarFormNovo();
        void qc.invalidateQueries({ queryKey: ["hub-admin-usuarios"] });
      } catch (e: any) {
        toast.error(e?.message || "Não foi possível liberar o acesso.");
      } finally {
        setSalvando(false);
      }
      return;
    }

    if (!nome.trim() || senha.length < 6) {
      toast.error("Preencha nome e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setSalvando(true);
    try {
      const { user_id } = await criarUsuarioFn({ data: { nome, email, senha } });
      if (user_id && ferramentasNovoUsuario.length > 0) {
        const { error } = await supabase
          .from("hub_user_tool_access")
          .insert(ferramentasNovoUsuario.map((tool_id) => ({ user_id, tool_id })));
        if (error) toast.error(`Usuário criado, mas houve um erro ao liberar as ferramentas: ${error.message}`);
      }
      toast.success("Usuário criado.");
      setNovoOpen(false);
      resetarFormNovo();
      void qc.invalidateQueries({ queryKey: ["hub-admin-usuarios"] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  // Remove só o acesso ao HUB (tira de hub_colaboradores, hub_admins e
  // hub_user_tool_access) — nunca mexe na conta de login em si, que continua
  // valendo pra qualquer outra ferramenta da QGO que essa pessoa use.
  async function handleRemoverDoHub(u: HubUsuario) {
    if (!window.confirm(`Remover "${u.email}" do Hub? O login dela nas outras ferramentas da QGO não é afetado.`))
      return;
    try {
      await supabase.from("hub_user_tool_access").delete().eq("user_id", u.user_id);
      await supabase.from("hub_admins").delete().eq("user_id", u.user_id);
      const { error } = await supabase.from("hub_colaboradores").delete().eq("user_id", u.user_id);
      if (error) throw new Error(error.message);
      toast.success("Removido do Hub.");
      void qc.invalidateQueries({ queryKey: ["hub-admin-usuarios"] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível remover.");
    }
  }

  async function toggleAcesso(u: HubUsuario, toolId: string, conceder: boolean) {
    const { error } = conceder
      ? await supabase.from("hub_user_tool_access").upsert({ user_id: u.user_id, tool_id: toolId })
      : await supabase.from("hub_user_tool_access").delete().eq("user_id", u.user_id).eq("tool_id", toolId);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["hub-admin-usuarios"] });
  }

  async function toggleAdmin(u: HubUsuario, tornarAdmin: boolean) {
    if (u.user_id === session?.user.id) {
      toast.error("Você não pode alterar sua própria permissão de administrador.");
      return;
    }
    const { error } = tornarAdmin
      ? await supabase.from("hub_admins").upsert({ user_id: u.user_id })
      : await supabase.from("hub_admins").delete().eq("user_id", u.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["hub-admin-usuarios"] });
  }

  const toolsAtivas = (ferramentas ?? []).filter((t) => t.ativo);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-gold-gradient text-primary-foreground hover:opacity-90"
              onClick={resetarFormNovo}
            >
              <Plus className="mr-1.5 size-4" /> Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (statusEmail !== "digitando") setStatusEmail("digitando");
                  }}
                  onBlur={() => void verificarEmail()}
                  placeholder="pessoa@qgo.com.br"
                />
                {statusEmail === "verificando" && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Checando se já existe conta com esse e-mail…
                  </p>
                )}
                {statusEmail === "existente" && (
                  <p className="text-xs text-primary">
                    Já existe uma conta com esse e-mail em outra ferramenta da QGO — vamos só liberar o Hub pra ela,
                    sem criar login novo.
                  </p>
                )}
              </div>
              {statusEmail !== "existente" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Senha provisória</Label>
                    <Input
                      type="text"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="mínimo 6 caracteres"
                    />
                    <p className="text-xs text-muted-foreground">
                      Combine essa senha com a pessoa por fora — ela pode trocar depois de entrar.
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>Ferramentas que essa pessoa vai poder abrir</Label>
                {toolsAtivas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma ferramenta cadastrada ainda.</p>
                ) : (
                  <div className="space-y-1 rounded-md border border-border p-2">
                    {toolsAtivas.map((t) => (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center justify-between rounded px-1.5 py-1 text-sm hover:bg-muted"
                      >
                        <span className="text-foreground">{t.nome}</span>
                        <Switch
                          checked={ferramentasNovoUsuario.includes(t.id)}
                          onCheckedChange={(v) => alternarFerramentaNovoUsuario(t.id, v)}
                        />
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Só o que você marcar aqui vai aparecer no menu dessa pessoa — o resto fica invisível pra ela. Dá
                  pra mudar isso depois, na tabela abaixo.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleCriar()} disabled={salvando || statusEmail === "verificando"}>
                {salvando && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                {statusEmail === "existente" ? "Liberar acesso ao Hub" : "Criar usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface-card overflow-hidden p-0">
        {usuariosQ.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando usuários…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                {toolsAtivas.map((t) => (
                  <TableHead key={t.id} className="text-center">
                    {t.nome}
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usuariosQ.data ?? []).map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{u.nome || "(sem nome)"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={u.is_admin}
                      onCheckedChange={(v) => void toggleAdmin(u, v)}
                      disabled={u.user_id === session?.user.id}
                    />
                  </TableCell>
                  {toolsAtivas.map((t) => (
                    <TableCell key={t.id} className="text-center">
                      <Switch
                        checked={u.is_admin || u.ferramentas.includes(t.id)}
                        disabled={u.is_admin}
                        onCheckedChange={(v) => void toggleAcesso(u, t.id, v)}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRemoverDoHub(u)}
                      title="Remover do Hub (não mexe no login dela nas outras ferramentas)"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Administradores têm acesso automático a todas as ferramentas ativas — por isso o interruptor some pra eles.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ferramentas: cadastro de cada ferramenta do ecossistema (nome, link, ícone,
// cor, se usa login automático).
// ---------------------------------------------------------------------------

const ICONES_SUGERIDOS = [
  "ClipboardList",
  "Building2",
  "Wallet",
  "Stethoscope",
  "FileText",
  "Users",
  "BarChart3",
  "Calculator",
  "Award",
  "MessageSquare",
  "AppWindow",
];

type FormFerramenta = {
  id?: string;
  slug: string;
  nome: string;
  descricao: string;
  url: string;
  icone: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  auto_login: boolean;
};

const FORM_VAZIO: FormFerramenta = {
  slug: "",
  nome: "",
  descricao: "",
  url: "",
  icone: "AppWindow",
  cor: "#c9a84c",
  ordem: 0,
  ativo: true,
  auto_login: true,
};

function FerramentasTab() {
  const qc = useQueryClient();
  const { data: ferramentas, isLoading } = useTodasFerramentas();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormFerramenta>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setOpen(true);
  }

  function abrirEdicao(t: HubTool) {
    setForm({
      id: t.id,
      slug: t.slug,
      nome: t.nome,
      descricao: t.descricao,
      url: t.url,
      icone: t.icone,
      cor: t.cor,
      ordem: t.ordem,
      ativo: t.ativo,
      auto_login: t.auto_login,
    });
    setOpen(true);
  }

  async function handleSalvar() {
    if (!form.nome.trim() || !form.url.trim() || !form.slug.trim()) {
      toast.error("Preencha ao menos nome, slug e URL.");
      return;
    }
    setSalvando(true);
    const payload = {
      slug: form.slug.trim(),
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      url: form.url.trim(),
      icone: form.icone.trim() || "AppWindow",
      cor: form.cor.trim() || "#c9a84c",
      ordem: form.ordem,
      ativo: form.ativo,
      auto_login: form.auto_login,
    };
    const { error } = form.id
      ? await supabase.from("hub_tools").update(payload).eq("id", form.id)
      : await supabase.from("hub_tools").insert(payload);
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ferramenta salva.");
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["hub-tools-all"] });
    void qc.invalidateQueries({ queryKey: ["hub-my-tools"] });
  }

  async function handleExcluir(t: HubTool) {
    if (!window.confirm(`Remover "${t.nome}" do hub? Isso não apaga a ferramenta em si, só a listagem aqui.`)) return;
    const { error } = await supabase.from("hub_tools").delete().eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["hub-tools-all"] });
    void qc.invalidateQueries({ queryKey: ["hub-my-tools"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo} className="bg-gold-gradient text-primary-foreground hover:opacity-90">
              <Plus className="mr-1.5 size-4" /> Nova ferramenta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar ferramenta" : "Nova ferramenta"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (identificador único)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>URL da ferramenta</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ícone</Label>
                <Input
                  list="icones-sugeridos"
                  value={form.icone}
                  onChange={(e) => setForm({ ...form, icone: e.target.value })}
                />
                <datalist id="icones-sugeridos">
                  {ICONES_SUGERIDOS.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Cor (hex)</Label>
                <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label className="cursor-pointer">Ativa</Label>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 sm:col-span-2">
                <div>
                  <Label className="cursor-pointer">Login automático</Label>
                  <p className="text-xs text-muted-foreground">
                    Só pra ferramentas que usam o mesmo projeto Supabase deste hub.
                  </p>
                </div>
                <Switch
                  checked={form.auto_login}
                  onCheckedChange={(v) => setForm({ ...form, auto_login: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleSalvar()} disabled={salvando}>
                {salvando && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando ferramentas…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(ferramentas ?? []).map((t) => {
            const Icon = getToolIcon(t.icone);
            return (
              <div key={t.id} className="surface-card flex items-start gap-3 p-4">
                <div
                  className="flex size-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${t.cor}22`, color: t.cor }}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{t.nome}</h3>
                    {!t.ativo && <Badge variant="secondary">inativa</Badge>}
                    {t.auto_login ? (
                      <Badge variant="outline" className="gap-1">
                        <Shield className="size-3" /> auto-login
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <ShieldOff className="size-3" /> link simples
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.url}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => abrirEdicao(t)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void handleExcluir(t)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
