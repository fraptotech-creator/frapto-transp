import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Teste de INTEGRAÇÃO do entrypoint real: sobe server/_core/index.ts (via tsx,
// o mesmo runner do `pnpm dev`) com env de produção INVÁLIDA e confirma o
// CÓDIGO DE SAÍDA real = 1 (não só que reportFatalStartup seta exitCode). Prova
// ponta a ponta que uma config de boot inválida NÃO sobe o servidor e encerra
// != 0 (o Railway então reinicia/alerta em vez de mascarar com 0).
//
// JWT_SECRET="x" (curto) garante a reprovação do guard INDEPENDENTE do .env em
// disco (o dotenv não sobrescreve uma var já definida no processo).
describe("entrypoint — env de produção inválida encerra != 0 (melhoria)", () => {
  it("node --import tsx index.ts com prod inválida sai com código 1", () => {
    const entry = path.resolve(process.cwd(), "server/_core/index.ts");
    const res = spawnSync(process.execPath, ["--import", "tsx", entry], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        NODE_ENV: "production",
        RAILWAY_ENVIRONMENT_ID: "test-int",
        JWT_SECRET: "x", // < 32 chars → guard reprova, dê o que der no .env
      },
    });
    expect(res.status).toBe(1);
    const saida = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
    expect(saida).toContain("[Boot] Falha fatal na inicialização");
  }, 40_000);
});
