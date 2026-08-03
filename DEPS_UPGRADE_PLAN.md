# Plano de upgrade de dependências (PR próprio — sem upgrade às cegas)

`pnpm audit --prod` em `498ab98`+: **35 vulnerabilidades (4 altas, 25 moderadas, 6 baixas)**.
Este documento é o PLANO; o upgrade em si vai num **PR separado**, com `--frozen-lockfile`,
testes, build e validação ao vivo. Nada de bump cego do lockfile.

## Cobertura criada ANTES (nesta rodada)

- `server/aiActiveHtml.test.ts`: HTML cru e URL perigosa (javascript:/data:) NÃO chegam ao DOM
  (motor react-markdown com `rehypePlugins=[]` + `urlTransform=safeAiUrl`) **e** um fence de mermaid
  ATRAVESSA `rehypePlugins=[]` intacto — ou seja, **`rehypePlugins=[]` NÃO desabilita o Mermaid** (no
  Streamdown 1.4.0 o Mermaid é decidido dentro do componente `code`, quando `language==="mermaid"`, sem
  prop para desligar). Logo a saída não-confiável da IA é um caminho ALCANÇÁVEL até mermaid→DOMPurify.

## Altas (4) — versão corrigida × caminho real

| Pacote           | Advisory                    | Corrigido                 | Caminho                                     | Risco real                                                                                                                                                                                                                                             |
| ---------------- | --------------------------- | ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@trpc/server`   | prototype pollution         | `>=11.8.0` (temos 11.6.0) | `@trpc/client@11.6.0 > @trpc/server@11.6.0` | Servidor recebe JSON não-confiável — **corrigir** (bump @trpc/\* juntos p/ 11.8.x).                                                                                                                                                                    |
| `path-to-regexp` | ReDoS                       | `>=0.1.13` (temos 0.1.12) | `express@4.21.2 > path-to-regexp@0.1.12`    | Transitiva do Express 4; ReDoS em rotas — bump express p/ patch de 4.21.x que traga 0.1.13, ou override.                                                                                                                                               |
| `lodash-es`      | code injection `_.template` | `>=4.18.0`                | `streamdown > mermaid@11.12.0 > ...`        | ⚠️ **4.18.0 NÃO existe** (lodash parou no 4.17.21). Só explora via `_.template` com input não-confiável — o mermaid não passa entrada de usuário ao `_.template`. Some junto com o upgrade do mermaid (menos deps lodash) — não há "fix version" real. |
| `lodash`         | code injection `_.template` | `>=4.18.0`                | `recharts@2.15.4 > lodash@4.17.21`          | Idem — sem fix version real; recharts não usa `_.template` com input do usuário. Reavaliar no bump do recharts.                                                                                                                                        |

## Moderadas relevantes

- `qs` (arrayLimit bypass) `>=6.14.1` via `express > body-parser > qs@6.13.0` → bump express/body-parser.
- `mdast-util-to-hast` `>=13.2.1` via `streamdown > react-markdown` → cai no upgrade do streamdown.
- `dompurify` (várias: XSS, FORBID_TAGS/SAFE_FOR_TEMPLATES bypass, prototype pollution) `>=3.3.2/3.4.0`
  via `streamdown > mermaid` → **é a cadeia do caminho alcançável do Mermaid**; prioridade junto do mermaid.
- `uuid` `>=11.1.1` (buffer bounds) — transitiva; baixa exposição.

## Sequência do PR (mínima e compatível, testada)

1. **Cadeia Streamdown/Mermaid/DOMPurify** (fecha o caminho alcançável da IA + várias moderadas):
   - bump `streamdown` para a versão que traga `mermaid>=` com `dompurify>=3.4.0` e `mdast-util-to-hast>=13.2.1`;
   - rodar `server/aiActiveHtml.test.ts` (a cobertura já existe) — HTML/URL continuam fora do DOM;
   - **avaliar desabilitar o Mermaid** no `AIChatBox` (a IA de frota não precisa de diagramas) como
     defesa-em-profundidade, independente da versão — decidir no PR com teste do caminho de render.
2. **@trpc/\* → 11.8.x** (client+server juntos; a API do adapter/httpLink é estável no 11.x) — rodar a
   suíte do pipeline (`trpcPipeline.test.ts`) e as procedures.
3. **express/body-parser** para o patch que traga `path-to-regexp>=0.1.13` e `qs>=6.14.1` — Express 4.x;
   validar a cadeia `/api/trpc`, `/api/track`, webhook e o 413/parser.
4. **recharts / uuid** — reavaliar; lodash só sai de fato ao trocar quem o traz (sem fix version própria).

Cada passo: `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm test` → `pnpm build` → CI (inclui
Docker) → deploy → `/api/ping` e `/api/ready` 200 → sondas. Um passo por commit; revert por commit se
o gate quebrar. **Não** introduzir `db:migrate` automático no boot.

## Migração 0005 — evidência (read-only, banco real `test`)

`SHOW COLUMNS` + contagens em produção (via DATABASE_URL do Railway, sem expor dados):
`stripe_events` tem `status enum('processing','processed','failed') default processing`,
`attempts int default 0`, `lastError varchar(200)`, `updatedAt timestamp default CURRENT_TIMESTAMP`.
**0 linhas; 0 stale (processing >5min); 0 processed/failed com attempts<1** (backfill não se aplica —
colunas aditivas, tabela vazia). Nada a reprocessar.
