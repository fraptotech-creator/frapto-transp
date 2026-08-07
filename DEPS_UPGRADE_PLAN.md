# Plano de upgrade de dependências (PR próprio — sem upgrade às cegas)

Regra do projeto: upgrade de deps é **PR/sessão dedicada**, em branch própria, com
**gate verde** (tsc + 508 testes + prettier + build), CI com `--frozen-lockfile`
e **validação ao vivo** após deploy. **Nunca** `pnpm audit --fix --force` (quebra
o `--frozen-lockfile` do deploy). Este arquivo é o PLANO; o upgrade vai à parte.

> Nota (2026-08-07): deploy de produção agora é **CI-gated** — job
> `deploy-production` no `ci.yml` (needs: [gate, docker]); o auto-deploy direto do
> Railway foi desligado. Nada é promovido antes de `docker=success`.

## STATUS — Trilha A + B1 + lodash EXECUTADAS (2026-08-06)

Aplicadas e gate verde (tsc 0 · 508/508 · build · prettier): `@trpc/* 11.6→11.18`,
`express-rate-limit 8.5→8.6`, e overrides `path-to-regexp 0.1.13`, `qs 6.15.3`,
`body-parser 1.20.6`, `dompurify 3.4.13`, **`lodash 4.18.1` + `lodash-es 4.18.1`**.
**Auditoria 38 → 6** (5→**0** high, 27→**6** moderate, 6→**0** low, 0 critical).

> CORREÇÃO: uma versão anterior deste plano afirmou que "lodash 4.18.0 não existe".
> **Estava errado** — o registro tem `lodash@4.18.1` e `lodash-es@4.18.1` (fix do
> CVE-2026-4800 / GHSA-r5fr-rjxr-66jc, patched `>=4.18.0`). As 2 HIGH foram
> **fechadas** via override, sem quebrar o gate. Não foi preciso aceite de risco.

As **6 restantes são todas moderate e todas no subtree `streamdown→mermaid`**
(mermaid:4, mdast-util-to-hast:1, uuid:1) — **INERTES** (mermaid neutralizado no
AST), saem na **Trilha B2** (streamdown v2). **Deferido (rotina, não-segurança):**
patches `stripe 22.4`, `zod 4.4`, `drizzle-kit 0.31.10`, `@anthropic-ai/sdk 0.115`
— bump quando conveniente (evitados agora p/ não mexer no Stripe às vésperas do
teste de compra).

## Retrato da auditoria — 2026-08-06 (`pnpm audit --prod`)

**38 vulnerabilidades: 5 high · 27 moderate · 6 low.** Onde moram (o que muda a
prioridade):

- **~24 estão no subtree `streamdown → mermaid`** (`dompurify` 17×, `mermaid` 4×,
  `lodash-es` 3×, `uuid`, `mdast-util-to-hast`…). **Inertes no runtime**: o app já
  neutraliza o Mermaid **estruturalmente** — `remarkNeutralizeMermaid`
  (`client/src/lib/aiSafeMarkdown.ts`) reescreve `lang mermaid→text` no AST antes
  do render, provado com o Streamdown REAL em `server/streamdownMermaid.test.ts`.
  O mermaid **nunca executa** em produção → essas advisories são dívida de
  higiene, não caminho aberto.
- **O restante está no caminho de request vivo** (tRPC, express, rate-limit,
  recharts) — é o que prioriza.

### Cobertura de segurança já no lugar (defesa não depende do upgrade)

- `remarkNeutralizeMermaid` desabilita o Mermaid (acima).
- `server/aiActiveHtml.test.ts`: HTML cru e URL perigosa (`javascript:`/`data:`)
  NÃO chegam ao DOM (react-markdown com `rehypePlugins=[]` + `urlTransform=safeAiUrl`).
- O upgrade abaixo **reduz superfície**; não é o que segura o XSS hoje.

### As 5 HIGH

| Pacote           | Vuln               | Patched    | Caminho                    | Exploitável           | Ação                                                |
| ---------------- | ------------------ | ---------- | -------------------------- | --------------------- | --------------------------------------------------- |
| `@trpc/server`   | `>=11.0.0 <11.8.0` | `>=11.8.0` | nosso servidor tRPC        | **Sim**               | minor `@trpc/* → 11.18.0`                           |
| `ip-address`     | `<=10.3.0`         | `>=10.3.1` | `express-rate-limit@8.5.2` | Baixa                 | minor `express-rate-limit → 8.6.2`                  |
| `path-to-regexp` | `<0.1.13`          | `>=0.1.13` | `express@4.21.2`           | Baixa (rotas simples) | override → `0.1.13`                                 |
| `lodash-es`      | `<=4.17.23`        | `>=4.18.0` | `streamdown→mermaid→…`     | **Não** (mermaid off) | cai com upgrade streamdown                          |
| `lodash`         | `<=4.17.23`        | `>=4.18.0` | `recharts@2.15.4`          | Baixa (client)        | **FECHADA** — override `lodash 4.18.1` (gate verde) |

## Estratégia — 3 trilhas, da menor à maior risco

### Trilha A — cirúrgica, baixo risco (recomendada primeiro)

Minors dentro do mesmo major + patches. Fecha 2 das 5 HIGH e várias moderate.
Cada bump: `pnpm install` → tsc + testes + build → commit próprio.

1. `@trpc/client` + `@trpc/react-query` + `@trpc/server` **11.6.0 → 11.18.0**
   (fecha HIGH `@trpc/server`; mesmo major, API estável).
2. `express-rate-limit` **8.5.2 → 8.6.2** (fecha HIGH `ip-address`; mesmo major).
3. `stripe` **22.3.0 → 22.4.0**, `drizzle-kit` **0.31.5 → 0.31.10**,
   `zod` **4.1.12 → 4.4.3**, `@anthropic-ai/sdk` **0.110 → 0.115** (patch/minor).
4. **Overrides** (`pnpm.overrides`) para transitivas do express 4 sem trocar major:
   `path-to-regexp` → `0.1.13`, e revisar `qs`/`body-parser` para as patched.
   Validar boot + rotas (`/api/ping`, `/api/ready`, `/api/trpc`, `/api/track`, webhook, 413).

**Ganho:** fecha `@trpc/server` e `ip-address` (HIGH) + moderadas do express, sem
tocar em nenhum major. Baixo risco, alto valor.

### Trilha B — subtree Streamdown/Mermaid/DOMPurify (superfície XSS da pendência)

- **B1 (barato, sem major):** `pnpm.overrides` forçando `dompurify → >=3.4.8` no
  subtree do mermaid → limpa as 17 advisories do dompurify sem tocar no streamdown.
  Belt-and-suspenders (o mermaid já está off). Validar build + `streamdownMermaid.test.ts` verdes.
- **B2 (correto, major):** `streamdown` **1.4.0 → 2.5.0**. Puxa mermaid/dompurify
  novos e limpa quase todo o subtree. **Exige reverificar** (testes reais como rede):
  (a) `remarkNeutralizeMermaid` ainda neutraliza; (b) export `defaultRemarkPlugins`
  ainda existe; (c) props `rehypePlugins`/`urlTransform` honradas; (d) seletores
  `data-streamdown='...'`/`data-code-block-container` dos testes; (e) css do katex
  inline no vitest. **Sub-sessão focada.**

Recomendação: **B1 agora** (fecha as 17 dompurify), **B2 depois** em sub-sessão.

- **B3 (PR SEPARADO — as 6 moderate restantes):** resolução compatível das 3 que
  sobraram no subtree, via `pnpm.overrides` (sem trocar o streamdown de major):
  `mdast-util-to-hast → >=13.2.1`, `mermaid → >=11.15.0`, `uuid → >=11.1.1`.
  Antes do merge: `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm test` →
  `pnpm build` → `pnpm audit --prod --json` (registrar a nova contagem) → **teste
  de Markdown/Mermaid** (`streamdownMermaid.test.ts` + render real) confirmando que
  a neutralização e o Markdown seguem intactos. NÃO misturar com o major do
  streamdown (B2). Se algum override quebrar tipos/build, cair para o mínimo que
  fecha a advisory sem regressão.

### Trilha C — majors pesados, DEFERIDOS (cada um em sessão própria com teste de feature)

Não misturar: `express` 4→5 (middleware/rotas), `vite` 7→8, `vitest` 2→4,
`typescript` 5.9→7 (port novo — muito arriscado), `openai` 6→7,
`recharts` 2→3 (fecha o HIGH do lodash, mas mexe nos gráficos),
`react-day-picker` 9→10, `superjson` 1→2, `cookie` 1→2, `framer-motion` 12→13,
`lucide-react` 0.453→1, `nanoid` 5→6, `react-resizable-panels` 3→4,
`@vitejs/plugin-react` 5→6, `@types/node` 24→26, `pnpm` 10→11.

`lodash`/`lodash-es` HIGH já **FECHADAS** via override `4.18.1` (ver STATUS no
topo) — não dependem mais do `recharts@3`. O upgrade de `recharts` fica deferido
por outros motivos (major, mexe nos gráficos), não pela segurança do lodash.

## Verificação obrigatória por bump

- Local: `pnpm install` (na branch, atualiza o lock) → `pnpm check` (tsc 0) →
  `pnpm test` (508+) → `pnpm build`.
- CI: passa com `--frozen-lockfile` (lock novo commitado).
- Ao vivo pós-deploy: `/api/ping` e `/api/ready` 200, boot sem erro novo, fluxo
  tocado exercitado. Rodar `pnpm audit --prod` de novo p/ confirmar a queda.
- Um passo por commit; revert por commit se o gate quebrar. **Não** pôr
  `db:migrate` no boot.

## Migração 0005 — evidência (read-only, banco real `test`)

`SHOW COLUMNS` + contagens em produção (via DATABASE_URL do Railway, sem expor dados):
`stripe_events` tem `status enum('processing','processed','failed') default processing`,
`attempts int default 0`, `lastError varchar(200)`, `updatedAt timestamp default CURRENT_TIMESTAMP`.
**0 linhas; 0 stale (processing >5min); 0 processed/failed com attempts<1** (backfill não se aplica —
colunas aditivas, tabela vazia). Nada a reprocessar.
