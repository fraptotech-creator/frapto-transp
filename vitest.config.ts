import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Inline o streamdown para o Vite transformar seus imports (ex.: katex.min.css),
    // permitindo testar o componente REAL no jsdom (senão o Node externaliza o
    // node_modules e falha em "Unknown file extension .css").
    server: { deps: { inline: ["streamdown"] } },
  },
});
