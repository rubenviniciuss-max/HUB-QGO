// @lovable.dev/vite-tanstack-config já inclui automaticamente: devtools do
// TanStack (só em dev), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
// nitro (build usando cloudflare como alvo padrão), injeção de VITE_*, alias
// @, dedupe de React/TanStack, logger de erros e detecção de sandbox. Não
// adicionar esses plugins manualmente — dá plugin duplicado e quebra o app.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redireciona o entry-point do servidor do TanStack Start pro
    // src/server.ts (nosso wrapper de erro de SSR).
    server: { entry: "server" },
  },
});
