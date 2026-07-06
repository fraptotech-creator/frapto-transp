# Deploy do frapto_transp no Railway

App de gestão de frota (Node + TypeScript + tRPC + Drizzle + MySQL/TiDB + React/Vite),
migrado do Manus para hospedagem própria no Railway — mesmo padrão de frapto-condo / whatsapp-crm-ai.

## Pré-requisitos (ações suas — precisam de credenciais que só você tem)

1. **Repositório GitHub**: crie `frapto-transp` (conta `fraptotech-creator`) e faça push desta branch.
2. **Projeto Railway**: novo projeto apontando para o repo. O Railway detecta o `Dockerfile` automaticamente (`railway.json`).
3. **Banco MySQL/TiDB**: provisione (TiDB Cloud ou MySQL do Railway) e pegue a `DATABASE_URL`.
4. **Google OAuth**: em https://console.cloud.google.com/apis/credentials → crie um OAuth Client (Web).
   - **Authorized redirect URI**: `https://SEU_DOMINIO/api/auth/google/callback`
   - Guarde `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
5. **Anthropic**: pegue uma `ANTHROPIC_API_KEY` (assistente de IA de frota).

## Variáveis de ambiente no Railway

Copie de `.env.example`. Críticas (o boot falha em produção sem elas):

| Var                                         | Descrição                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`                              | `mysql://user:pass@host:port/frapto_transp`                                |
| `JWT_SECRET`                                | ≥32 chars. Gere: `openssl rand -base64 32`                                 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google                                                               |
| `APP_BASE_URL`                              | URL pública, sem barra final (ex.: `https://frapto-transp.up.railway.app`) |
| `OWNER_EMAIL`                               | Email que, no 1º login, vira admin                                         |
| `ANTHROPIC_API_KEY`                         | Assistente de IA                                                           |

`NODE_ENV=production` e `PORT` já vêm do `railway.json` / Railway.

## Migração do banco (schema Drizzle)

Com a `DATABASE_URL` de produção no ambiente local (ou via Railway CLI):

```bash
pnpm db:push   # drizzle-kit generate && migrate
```

Cria as tabelas: users, vehicles, drivers, trips, maintenance, notifications, expenses, revenues, documents.

## Validação ao vivo (fazer após o 1º deploy)

1. `GET https://SEU_DOMINIO/api/ping` → `200 {"ok":true}` (healthcheck do Railway).
2. Abrir a home → tela "Entrar com Google" → login → cai no Painel.
3. Cadastrar 1 veículo → **recarregar a página** → o veículo persiste (confirma DB real).
4. Menu "Assistente IA" → perguntar "Quais CNHs vencem nos próximos 30 dias?" → resposta coerente com os dados.
5. Conferir logs do Railway: boot limpo, sem erro do código novo.

## O que ficou adiado (etapas dedicadas futuras)

- **Rastreamento com mapa** (`/trips/:id/tracking`): placeholder. Religar com Google Maps + chave própria.
- **Upload de documentos** (`/documents`): a tela lê veículos/motoristas, mas o upload de arquivo depende de
  storage (o proxy do Manus foi removido). Plugar Cloudflare R2 / S3 numa etapa dedicada.
- **Deps órfãs** (`axios`, `@aws-sdk/*`): remover em sessão de deps dedicada (evita mexer no lockfile agora).

## Notas técnicas

- Build local não-Docker validado: `pnpm install --frozen-lockfile`, `pnpm build`, boot de produção
  (`node dist/index.js`) servindo `/api/ping` e o HTML, e fail-closed abortando com `JWT_SECRET` fraco.
- O build da imagem Docker **não** foi executado localmente (Docker indisponível na máquina de dev);
  o `Dockerfile` replica exatamente os passos já validados, com `pnpm@10.4.1` pinado.
