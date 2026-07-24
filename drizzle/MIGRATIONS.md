# Migrações do banco (versionadas)

Antes o schema ia para o banco por `drizzle-kit push` (interativo, sem
histórico). Agora o fluxo é **versionado**: cada mudança de `schema.ts` gera um
SQL revisável em `drizzle/migrations/`, e o CI barra qualquer schema sem sua
migração (passo "Migrações em sincronia com o schema").

## Fluxo (nunca `push` em produção)

1. Edite `drizzle/schema.ts`.
2. `pnpm db:generate` → cria `drizzle/migrations/NNNN_*.sql` + snapshot.
3. **Revise o SQL** no PR (é o que vai rodar no banco).
4. `pnpm db:migrate` aplica as migrações pendentes (usa `DATABASE_URL`).
   - Em produção: rode num passo controlado (janela combinada), não no boot.

`pnpm db:push` fica só para protótipo local — **nunca** contra produção.

## Adotar migrações num banco que JÁ existe (baselining)

O banco de produção já tem todas as tabelas (foram criadas por `push`). Rodar
`db:migrate` do zero tentaria executar `0000_baseline.sql` (CREATE TABLE) e
**falharia** ("table already exists"). Para adotar sem recriar nada:

1. Crie a tabela de controle e marque a `0000_baseline` como JÁ aplicada, para
   o drizzle não tentar recriá-la. Confira o hash em
   `drizzle/migrations/meta/_journal.json` e registre-o em
   `__drizzle_migrations` (a mesma tabela que o `migrate` usa).
2. A partir daí, `db:migrate` aplica só as migrações novas (`0001` em diante).

> Faça isso uma única vez, com backup do banco e fora do horário de pico.

## Migração 0001 — índice único em `drivers.trackingToken` (P1 #3)

`ALTER TABLE drivers ADD CONSTRAINT drivers_tracking_token_unico
UNIQUE(trackingToken)`. Additiva e de baixo risco (o token é `randomBytes(24)`;
MySQL permite múltiplos NULL). **Antes de aplicar**, confirme que não há
duplicado (deveria vir vazio):

```sql
SELECT trackingToken, COUNT(*) c
FROM drivers WHERE trackingToken IS NOT NULL
GROUP BY trackingToken HAVING c > 1;
```

Se vier alguma linha: **PARE e reporte** — não apague dados; rotacione o token
do motorista mais recente (o app gera outro no próximo login) antes de aplicar.

## DEFERIDO — Foreign keys / integridade referencial (P2 #8)

As FKs reais (`expenses/revenues/documents/trips → vehicles/drivers/trips`) são
**reforço**: a posse cross-tenant já é validada em runtime (`assertRefsOwned`,
em create e update). Elas ficam DEFERIDAS porque `ADD FOREIGN KEY` **falha se
houver linha órfã** legada — e daqui não há acesso ao dado de produção para
verificar. Antes de gerar/aplicar a migração de FK, rode os checks (todos
devem vir vazios):

```sql
SELECT id FROM expenses  WHERE veiculoId  IS NOT NULL AND veiculoId  NOT IN (SELECT id FROM vehicles);
SELECT id FROM expenses  WHERE motoristId IS NOT NULL AND motoristId NOT IN (SELECT id FROM drivers);
SELECT id FROM expenses  WHERE viagemId   IS NOT NULL AND viagemId   NOT IN (SELECT id FROM trips);
SELECT id FROM revenues  WHERE viagemId   IS NOT NULL AND viagemId   NOT IN (SELECT id FROM trips);
SELECT id FROM documents WHERE veiculoId  IS NOT NULL AND veiculoId  NOT IN (SELECT id FROM vehicles);
SELECT id FROM documents WHERE motoristId IS NOT NULL AND motoristId NOT IN (SELECT id FROM drivers);
SELECT id FROM trips     WHERE veiculoId   NOT IN (SELECT id FROM vehicles);
SELECT id FROM trips     WHERE motoristaId NOT IN (SELECT id FROM drivers);
SELECT id FROM trip_positions WHERE tripId NOT IN (SELECT id FROM trips);
SELECT id FROM maintenance    WHERE veiculoId NOT IN (SELECT id FROM vehicles);
```

Se QUALQUER um retornar linhas: **PARE e reporte com a evidência** — decida
caso a caso (corrigir o vínculo ou arquivar), **sem apagar** às cegas. Só com
tudo vazio: adicione as FKs em `schema.ts`, `pnpm db:generate`, revise e
aplique. Considere `ON DELETE` explícito (ex.: `trip_positions` → CASCADE; hoje
esse cascade é feito em código no `deleteTrip`).
