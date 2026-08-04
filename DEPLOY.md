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

| Var                                         | Descrição                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | `mysql://user:pass@host:port/frapto_transp`                                                                          |
| `JWT_SECRET`                                | ≥32 chars. Gere: `openssl rand -base64 32`                                                                           |
| `APP_BASE_URL`                              | URL pública, sem barra final (ex.: `https://frapto-transp.up.railway.app`)                                           |
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

1. `GET https://SEU_DOMINIO/api/ping` → `200 {"ok":true}` (LIVENESS — só diz que o
   processo está de pé) e `GET .../api/ready` → `200 {"ready":true}` (READINESS —
   faz `SELECT 1`; é este o `healthcheckPath` do Railway, então o deploy só é
   promovido/roteado com banco utilizável; 503 se o banco estiver fora/lento).
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
- O build da imagem Docker **não** roda na máquina de dev (Docker indisponível), mas o **CI executa
  `docker build`** da mesma imagem (job `docker` em `.github/workflows/ci.yml`), com o lockfile
  congelado e sem segredos — um `Dockerfile` quebrado é pego no CI, não no deploy.

## Segurança de infra (DNS / proxy) — passos do usuário

- **Readiness + draining + manifesto.** `healthcheckPath=/api/ready` (readiness com `SELECT 1`) — o
  Railway não promove/roteia sem banco. `drainingSeconds=30` no `railway.json`: no redeploy o Railway
  envia SIGTERM e espera até 30s antes do SIGKILL; o app para de aceitar conexões, drena e força a saída
  em `SHUTDOWN_DRAIN_MS=25s` (alinhado, sai antes do SIGKILL). **Deadline de trabalho em contrato = 25s**:
  upload (teto de leitura 30s + R2/DB, tipicamente segundos) e IA (timeout 60s no pior caso) drenam; o
  raro caso de IA passando de 25s num deploy é cortado e o cliente repete. Enums do manifesto são
  **case-sensitive MAIÚSCULOS** (`builder:"DOCKERFILE"`, `restartPolicyType:"ON_FAILURE"`) — validados de
  forma determinística no CI por `server/railwayManifest.test.ts` (um valor minúsculo cairia no default
  silenciosamente). Após o deploy, confira no painel/API que o manifesto resolvido, `checkSuites=true`,
  readiness (200), draining e restart policy estão efetivos.
- **Deploy só após CI verde (Wait for CI).** O gatilho de deploy do serviço tem `checkSuites=true`
  (Railway → Settings → o "Wait for CI" do trigger do GitHub; setável também pela API GraphQL:
  `deploymentTriggerUpdate(id, input:{ checkSuites:true })`). Assim a Railway **só promove um commit de
  `main` depois que o check suite do CI conclui VERDE** — se o CI falha (tsc/testes/prettier/build/Docker/
  drift), o deploy não inicia e o deploy anterior (bom) permanece no ar. Isto NÃO é controlado pelo
  `railway.json` (ele só define build/deploy da imagem, não a dependência do CI) — é um ajuste do trigger.
- **Env do Railway é a fonte da verdade.** O bloco `environmentVariables` do `railway.json` é
  **ignorado** pela Railway (foi removido para não enganar) — as variáveis valem só via painel/CLI/API.
  Os boot-guards falham fechado (o app não sobe sem `JWT_SECRET`/`DATABASE_URL`/`APP_BASE_URL`/
  `AI_CONFIG_ENCRYPTION_KEY`). Confirme `NODE_ENV=production` no painel (já setado).
- **IP real:** `trust proxy=1` — o XFF forjado pelo cliente é ignorado (verificado em pentest). Se um
  dia houver **múltiplas réplicas**, migrar rate-limit/semáforo de memória para store compartilhado.
- **Apex → www (PENDENTE de DNS do usuário):** validação de fora em 2026-08-03 mostrou
  `https://fraptotransp.com.br` **não resolvendo/conectando** (`http=000`) — o apex NÃO está apontado ao
  Railway. O app já faz o 301 apex→`https://www.fraptotransp.com.br` (middleware em `_core/index.ts`), mas
  isso só vale depois que o apex chegar ao serviço. AÇÃO do usuário: no provedor de DNS, apontar o apex ao
  Railway (registro ALIAS/ANAME/A conforme o provedor) e adicionar o domínio `fraptotransp.com.br` no
  serviço do Railway; então revalidar de fora (`curl -sI https://fraptotransp.com.br` deve dar 301 → www).
  `https://www.fraptotransp.com.br` responde 200 normalmente.
- **Healthcheck: LIVENESS × READINESS.** O `HEALTHCHECK` do Docker usa `/api/ping` (liveness — o processo
  está de pé, sem depender do banco); o healthcheck do Railway usa `/api/ready` (readiness — `SELECT 1`).
  Diferença PROPOSITAL: se o container usasse `/api/ready`, um blip do banco o marcaria unhealthy e
  causaria restart em cascata. `/api/ready` é resistente a carga (cache curto + single-flight).
- **DMARC (evoluir por etapas, sem quebrar e-mail legítimo):** manter SPF/DKIM do Resend e adicionar o
  TXT `_dmarc.fraptotransp.com.br`:
  1. `v=DMARC1; p=none; rua=mailto:fraptotech@gmail.com` — coletar/analisar relatórios;
  2. `p=quarantine; pct=25` e aumentar o `pct` gradualmente;
  3. `p=reject` quando todas as fontes legítimas estiverem alinhadas.
