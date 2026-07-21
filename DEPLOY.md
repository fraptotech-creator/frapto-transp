# Deploy do frapto_transp no Railway

App de gestão de frota (Node + TypeScript + tRPC + Drizzle + MySQL/TiDB + React/Vite),
migrado do Manus para hospedagem própria no Railway — mesmo padrão de frapto-condo / whatsapp-crm-ai.

## Pré-requisitos (ações suas — precisam de credenciais que só você tem)

1. **Repositório GitHub**: crie `frapto-transp` (conta `fraptotech-creator`) e faça push desta branch.
2. **Projeto Railway**: novo projeto apontando para o repo. O Railway detecta o `Dockerfile` automaticamente (`railway.json`).
3. **Banco MySQL/TiDB**: provisione (TiDB Cloud ou MySQL do Railway) e pegue a `DATABASE_URL`.
4. **Anthropic**: pegue uma `ANTHROPIC_API_KEY` (assistente de IA de frota).

## Variáveis de ambiente no Railway

Copie de `.env.example`. Críticas (o boot falha em produção sem elas):

| Var                                         | Descrição                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`                              | `mysql://user:pass@host:port/frapto_transp`                                |
| `JWT_SECRET`                                | ≥32 chars. Gere: `openssl rand -base64 32`                                 |
| `APP_BASE_URL`                              | URL pública, sem barra final (ex.: `https://frapto-transp.up.railway.app`) |
| `SUPER_ADMIN_OPEN_ID` / `SUPER_ADMIN_EMAIL` | Dono da PLATAFORMA (painel `/plataforma`). Os DOIS precisam bater com o registro do usuário; vazio = ninguém é admin |

⚠️ `NODE_ENV=production` precisa ser setado **no painel do Railway**. O bloco
`environmentVariables` do `railway.json` NÃO define variável de ambiente (só
build/deploy) — sem isso, o boot-guard de segredos fica inerte e a API vaza
stack trace nos erros.

**Assistente de IA (opcional):** não precisa de env var. Depois de logar como admin,
vá em **Configurações → Assistente de IA** e escolha o provedor (Claude / GPT /
compatível-OpenAI), cole a chave e o modelo. (Se preferir via env, `ANTHROPIC_API_KEY`
ainda funciona como fallback do provedor Anthropic.)

## Migração do banco (schema Drizzle)

Com a `DATABASE_URL` de produção no ambiente local (ou via Railway CLI):

```bash
pnpm db:push   # drizzle-kit push — aplica o schema.ts direto (banco novo)
```

Cria as tabelas: users, vehicles, drivers, trips, maintenance, notifications, expenses, revenues, documents.

## Validação ao vivo (fazer após o 1º deploy)

1. `GET https://SEU_DOMINIO/api/ping` → `200 {"ok":true}` (healthcheck do Railway).
2. Abrir a home → landing → cadastrar/entrar com email e senha → cai no Painel.
3. Cadastrar 1 veículo → **recarregar a página** → o veículo persiste (confirma DB real).
4. Menu "Assistente IA" → perguntar "Quais CNHs vencem nos próximos 30 dias?" → resposta coerente com os dados.
5. Conferir logs do Railway: boot limpo, sem erro do código novo.

## O que ficou adiado (etapas dedicadas futuras)

- **Stripe test → live**: virar as chaves ao começar a vender.
- **Deps sem uso** (`framer-motion`, `autoprefixer`, `postcss`, `tailwindcss-animate`,
  `@tailwindcss/typography`): remover em sessão de deps dedicada — mexer no lockfile
  pode quebrar o `--frozen-lockfile` do deploy.
- **Tabela `notifications`** (drizzle/schema.ts): nenhum código lê ou escreve nela (a
  tela `/notifications` deriva tudo de `dashboard.stats`). Tirar do schema exige cuidado:
  `drizzle-kit push` é schema-first e DERRUBARIA a tabela em produção.

(Mapa de rota e upload de documentos SAÍRAM daqui — estão no ar: OpenStreetMap/Leaflet
e Cloudflare R2, respectivamente.)

## Notas técnicas

- Build local não-Docker validado: `pnpm install --frozen-lockfile`, `pnpm build`, boot de produção
  (`node dist/index.js`) servindo `/api/ping` e o HTML, e fail-closed abortando com `JWT_SECRET` fraco.
- O build da imagem Docker **não** foi executado localmente (Docker indisponível na máquina de dev);
  o `Dockerfile` replica exatamente os passos já validados, com `pnpm@10.4.1` pinado.
