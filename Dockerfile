# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package files E a pasta de patches (referenciados em pnpm.patchedDependencies).
# Precisa vir ANTES do install para evitar ENOENT em patches/*.patch.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# pnpm PINADO na versão do packageManager para honrar pnpm.patchedDependencies/overrides.
RUN npm install -g pnpm@10.4.1 && pnpm install --frozen-lockfile

# Copiar o restante do código e buildar (vite build + esbuild do server).
COPY . .
RUN pnpm build

# ---- Production stage ----
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@10.4.1

# Instalar deps completas: vite.config.ts / _core/vite.ts importam pacotes que o
# bundle do server mantém como external (vite e plugins). Sem eles o serveStatic
# falha no boot com ERR_MODULE_NOT_FOUND.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Copiar artefatos do build.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/public ./client/public

# Railway injeta PORT automaticamente.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/ping', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/index.js"]
