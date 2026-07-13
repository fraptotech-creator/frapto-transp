import { defineConfig } from "vite";

// App nativo minúsculo: uma página só. Build sai em dist/ (webDir do Capacitor).
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
