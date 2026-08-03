import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { User } from "../drizzle/schema";

// A barreira valida a sessão via sdk.validateActiveSession — controlada aqui.
const sdkMock = vi.hoisted(() => ({
  validateActiveSession: vi.fn(),
  authenticateRequest: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: sdkMock }));

import { mountTrpcPipeline } from "./_core/trpcPipeline";
import { getTrpcProc } from "./_core/uploadCapability";
import { getUploadSlot } from "./_core/uploadSlot";
import { _resetRateLimit } from "./_core/rateLimit";
import { uploadSemaphore } from "./_core/concurrency";
import {
  UPLOAD_IP_LIMIT,
  UPLOAD_RATE_LIMIT,
  UPLOAD_CONCURRENCY_PER_USER,
} from "./_core/uploadGate";

const activeUser = { openId: "u1", sessionVersion: 0 } as unknown as User;

interface AppOpts {
  uploadLimit?: string;
  hang?: boolean;
  status?: number;
}

function buildApp(opts: AppOpts = {}) {
  const spy = {
    uploadRuns: 0,
    adapterRuns: 0,
    inFlight: 0,
    lastBodyKeys: [] as string[],
  };
  let resolveHang: () => void = () => {};
  const hangPromise = new Promise<void>(r => {
    resolveHang = r;
  });
  const app = express();
  app.set("trust proxy", 1);
  const smallParser = express.json({ limit: "128kb" });
  const realUpload = express.json({ limit: opts.uploadLimit ?? "15mb" });
  const uploadParser: express.RequestHandler = (req, res, next) => {
    spy.uploadRuns++;
    realUpload(req, res, next);
  };
  const adapter: express.RequestHandler = async (req, res) => {
    spy.adapterRuns++;
    // espelha allowBatching:false do adapter real
    if (
      req.query.batch !== undefined ||
      (getTrpcProc(res) ?? "").includes(",")
    ) {
      res.status(400).json({ error: "no batch" });
      return;
    }
    // Espelha a procedure real: a OPERAÇÃO PESADA assume o slot e o libera no
    // finally (mantém até "R2/DB" terminarem, mesmo com abort no meio).
    const slot = getUploadSlot(res);
    slot?.claimOperation();
    try {
      spy.inFlight++;
      if (opts.hang) await hangPromise;
      spy.lastBodyKeys = Object.keys(
        (req.body as Record<string, unknown>) ?? {}
      );
      res.status(opts.status ?? 200).json({ ok: true });
    } finally {
      spy.inFlight--;
      slot?.release();
    }
  };
  mountTrpcPipeline(app, {
    authLimiter: (_q, _s, n) => n(),
    apiLimiter: (_q, _s, n) => n(),
    smallParser,
    uploadParser,
    adapter,
  });
  return { app, spy, resolveHang: () => resolveHang() };
}

interface Resp {
  status: number;
  text: string;
}
function request(
  port: number,
  o: {
    method?: string;
    path: string;
    body?: string;
    headers?: Record<string, string>;
    abortAfterMs?: number;
  }
): Promise<Resp> {
  return new Promise((resolve, reject) => {
    const data = o.body ? Buffer.from(o.body) : undefined;
    const headers: Record<string, string | number> = { ...(o.headers ?? {}) };
    if (data) {
      headers["content-type"] = headers["content-type"] ?? "application/json";
      headers["content-length"] = data.length;
    }
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: o.method ?? "GET",
        path: o.path,
        headers,
      },
      res => {
        let t = "";
        res.on("data", c => (t += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: t }));
      }
    );
    req.on("error", err => reject(err));
    if (o.abortAfterMs !== undefined) {
      // envia parcial e aborta: exercita o release em 'close'
      req.write('{"');
      setTimeout(() => req.destroy(), o.abortAfterMs);
      return;
    }
    if (data) req.write(data);
    req.end();
  });
}

async function start(opts: AppOpts = {}) {
  const built = buildApp(opts);
  const server = http.createServer(built.app);
  await new Promise<void>(r => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    spy: built.spy,
    resolveHang: built.resolveHang,
    close: () => new Promise<void>(r => server.close(() => r())),
  };
}

async function waitFor(cond: () => boolean, ms = 1500): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout esperando condição");
    await new Promise(r => setTimeout(r, 5));
  }
}

const UP = "/api/trpc/documents.upload";
const upBody = '{"fileName":"x"}';
const big = (n: number) => `{"j":"${"a".repeat(n)}"}`;

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimit();
  uploadSemaphore.reset();
  sdkMock.validateActiveSession.mockResolvedValue(activeUser);
});

describe("pipeline /api/trpc — parser grande fail-closed (Lote 1)", () => {
  it("POST canônico SEM cookie → 401 e o parser grande NÃO roda", async () => {
    sdkMock.validateActiveSession.mockResolvedValue(null);
    const { port, spy, close } = await start();
    const r = await request(port, { method: "POST", path: UP, body: upBody });
    expect(r.status).toBe(401);
    expect(spy.uploadRuns).toBe(0);
    expect(spy.adapterRuns).toBe(0);
    await close();
  });

  it("rejeição INESPERADA no gate async (banco fora) → 5xx sanitizado, sem parser/adapter, processo vivo", async () => {
    // validateActiveSession REJEITA (não resolve null) — no Express 4 cru isso
    // viraria unhandledRejection e derrubaria o processo.
    sdkMock.validateActiveSession.mockRejectedValue(new Error("db down"));
    const { port, spy, close } = await start();
    const r = await request(port, { method: "POST", path: UP, body: upBody });
    expect(r.status).toBe(500);
    expect(r.text).not.toContain("db down"); // sanitizado
    expect(spy.uploadRuns).toBe(0); // parser grande não rodou
    expect(spy.adapterRuns).toBe(0); // adapter não rodou
    // O teste chegar aqui já prova que o processo não caiu por unhandledRejection.
    await close();
  });

  it("cookie inválido / sessão revogada → 401 ANTES do parser (parser não roda)", async () => {
    sdkMock.validateActiveSession.mockResolvedValue(null); // JWT ok mas revogado
    const { port, spy, close } = await start();
    const r = await request(port, {
      method: "POST",
      path: UP,
      body: upBody,
      headers: { cookie: "frapto_session=assinado-mas-revogado" },
    });
    expect(r.status).toBe(401);
    expect(spy.uploadRuns).toBe(0);
    await close();
  });

  it("backstop por IP: após o teto, requests sem cookie viram 429 (log/HMAC flood barrado)", async () => {
    sdkMock.validateActiveSession.mockResolvedValue(null);
    const { port, spy, close } = await start();
    let saw429 = false;
    for (let i = 0; i < UPLOAD_IP_LIMIT + 1; i++) {
      const r = await request(port, { method: "POST", path: UP, body: upBody });
      if (r.status === 429) saw429 = true;
    }
    expect(saw429).toBe(true);
    expect(spy.uploadRuns).toBe(0); // nunca parseou nada
    await close();
  });

  it("PUT/PATCH/DELETE/GET no path de upload → 405 antes do parser grande", async () => {
    const { port, spy, close } = await start();
    for (const method of ["PUT", "PATCH", "DELETE", "GET"]) {
      const r = await request(port, {
        method,
        path: UP,
        body: upBody,
        headers: { cookie: "c=1" },
      });
      expect(r.status, method).toBe(405);
    }
    expect(spy.uploadRuns).toBe(0);
    expect(spy.adapterRuns).toBe(0);
    await close();
  });

  it("aliases/paths não-canônicos → 404 antes do adapter (não executam procedure)", async () => {
    const { port, spy, close } = await start();
    const paths = [
      "/api/trpc/x/documents.upload",
      "/api/trpc//documents.upload",
      "/api/trpc/documents.upload/",
      "/api/trpc/documents.upload%2f..",
    ];
    for (const path of paths) {
      const r = await request(port, {
        method: "POST",
        path,
        body: upBody,
        headers: { cookie: "c=1" },
      });
      expect(r.status, path).toBe(404);
    }
    expect(spy.uploadRuns).toBe(0);
    expect(spy.adapterRuns).toBe(0);
    await close();
  });

  it("procedure comum acima de 128 KB → 413 (parser pequeno)", async () => {
    const { port, spy, close } = await start();
    const r = await request(port, {
      method: "POST",
      path: "/api/trpc/vehicles.list",
      body: big(200_000),
      headers: { cookie: "c=1" },
    });
    expect(r.status).toBe(413);
    expect(spy.adapterRuns).toBe(0);
    await close();
  });

  it("sessão ATIVA: upload dentro de 15 MB (>128 KB) alcança a procedure", async () => {
    const { port, spy, close } = await start();
    const r = await request(port, {
      method: "POST",
      path: UP,
      body: big(200_000), // passaria de 128 KB, mas o path de upload usa 15 MB
      headers: { cookie: "c=1" },
    });
    expect(r.status).toBe(200);
    expect(spy.uploadRuns).toBe(1);
    expect(spy.adapterRuns).toBe(1);
    expect(spy.lastBodyKeys).toContain("j");
    await close();
  });

  it("batch (?batch=1) passa a canonicalização e o adapter responde 400", async () => {
    const { port, close } = await start();
    const r = await request(port, {
      method: "GET",
      path: "/api/trpc/auth.me?batch=1",
      headers: { cookie: "c=1" },
    });
    expect(r.status).toBe(400);
    await close();
  });

  it("rate-limit por usuário: após o teto, 429 (parser não roda no 429)", async () => {
    const { port, spy, close } = await start();
    for (let i = 0; i < UPLOAD_RATE_LIMIT; i++) {
      const r = await request(port, {
        method: "POST",
        path: UP,
        body: upBody,
        headers: { cookie: "c=1" },
      });
      expect(r.status).toBe(200);
    }
    const over = await request(port, {
      method: "POST",
      path: UP,
      body: upBody,
      headers: { cookie: "c=1" },
    });
    expect(over.status).toBe(429);
    expect(spy.uploadRuns).toBe(UPLOAD_RATE_LIMIT); // o 429 não parseou
    await close();
  });

  it("concorrência: acima do teto por usuário → 429 (slots liberados ao fim)", async () => {
    const { port, spy, resolveHang, close } = await start({ hang: true });
    const inflight = [];
    for (let i = 0; i < UPLOAD_CONCURRENCY_PER_USER; i++) {
      inflight.push(
        request(port, {
          method: "POST",
          path: UP,
          body: upBody,
          headers: { cookie: "c=1" },
        })
      );
    }
    await waitFor(() => spy.inFlight === UPLOAD_CONCURRENCY_PER_USER);
    // 1 a mais enquanto os slots estão ocupados → 429
    const over = await request(port, {
      method: "POST",
      path: UP,
      body: upBody,
      headers: { cookie: "c=1" },
    });
    expect(over.status).toBe(429);
    resolveHang();
    const done = await Promise.all(inflight);
    expect(done.every(d => d.status === 200)).toBe(true);
    await waitFor(() => uploadSemaphore.snapshot().global === 0);
    expect(uploadSemaphore.snapshot().global).toBe(0);
    await close();
  });

  it("slot é liberado em SUCESSO (finish)", async () => {
    const { port, close } = await start();
    const r = await request(port, {
      method: "POST",
      path: UP,
      body: upBody,
      headers: { cookie: "c=1" },
    });
    expect(r.status).toBe(200);
    await waitFor(() => uploadSemaphore.snapshot().global === 0);
    expect(uploadSemaphore.snapshot().global).toBe(0);
    await close();
  });

  it("slot é liberado em ERRO do adapter (finish com 500)", async () => {
    const { port, close } = await start({ status: 500 });
    const r = await request(port, {
      method: "POST",
      path: UP,
      body: upBody,
      headers: { cookie: "c=1" },
    });
    expect(r.status).toBe(500);
    await waitFor(() => uploadSemaphore.snapshot().global === 0);
    expect(uploadSemaphore.snapshot().global).toBe(0);
    await close();
  });

  it("slot é liberado em 413 do parser grande (finish)", async () => {
    // parser grande com limite pequeno (dublê): corpo acima dele → 413.
    const { port, spy, close } = await start({ uploadLimit: "1kb" });
    const r = await request(port, {
      method: "POST",
      path: UP,
      body: big(4000),
      headers: { cookie: "c=1" },
    });
    expect(r.status).toBe(413);
    expect(spy.uploadRuns).toBe(1); // foi o parser grande que barrou
    await waitFor(() => uploadSemaphore.snapshot().global === 0);
    expect(uploadSemaphore.snapshot().global).toBe(0);
    await close();
  });

  it("slot é liberado em ABORT do cliente durante o PARSING (close)", async () => {
    const { port, close } = await start();
    await request(port, {
      method: "POST",
      path: UP,
      headers: { cookie: "c=1", "content-length": "500000" },
      abortAfterMs: 30,
    }).catch(() => undefined); // o abort rejeita o cliente; ok
    await waitFor(() => uploadSemaphore.snapshot().global === 0);
    expect(uploadSemaphore.snapshot().global).toBe(0);
    await close();
  });

  it("abort DURANTE a operação: slot é MANTIDO até a op assentar, depois liberado", async () => {
    const { port, spy, resolveHang, close } = await start({ hang: true });
    // Corpo COMPLETO → parser conclui → adapter (op pesada) assume o slot e trava.
    const data = Buffer.from(upBody);
    const clientReq = http.request({
      host: "127.0.0.1",
      port,
      method: "POST",
      path: UP,
      headers: {
        cookie: "c=1",
        "content-type": "application/json",
        "content-length": data.length,
      },
    });
    clientReq.on("error", () => undefined); // o abort rejeita o cliente
    clientReq.write(data);
    clientReq.end();
    await waitFor(() => spy.inFlight === 1); // op assumiu o slot
    expect(uploadSemaphore.snapshot().global).toBe(1);
    clientReq.destroy(); // ABORT no meio da operação
    await new Promise(r => setTimeout(r, 60)); // deixa o 'close' propagar
    // slot MANTIDO: fechar o socket não pode abrir vaga enquanto a op roda
    expect(uploadSemaphore.snapshot().global).toBe(1);
    resolveHang(); // op assenta (finally libera)
    await waitFor(() => uploadSemaphore.snapshot().global === 0);
    expect(uploadSemaphore.snapshot().global).toBe(0);
    await close();
  });

  it("teto GLOBAL: 11º trabalho pesado negado com 10 pendentes; todos liberados ao fim", async () => {
    // Usuários DISTINTOS → o teto por usuário (2) não é o gargalo; o global (10) é.
    let n = 0;
    sdkMock.validateActiveSession.mockImplementation(
      async () => ({ openId: `u${n++}`, sessionVersion: 0 }) as unknown as User
    );
    const { port, spy, resolveHang, close } = await start({ hang: true });
    const inflight = [];
    for (let i = 0; i < 10; i++) {
      inflight.push(
        request(port, {
          method: "POST",
          path: UP,
          body: upBody,
          headers: { cookie: "c=1" },
        })
      );
    }
    await waitFor(() => spy.inFlight === 10); // 10 ops assumiram slots
    expect(uploadSemaphore.snapshot().global).toBe(10);
    const over = await request(port, {
      method: "POST",
      path: UP,
      body: upBody,
      headers: { cookie: "c=1" },
    });
    expect(over.status).toBe(429); // 11º: teto global cheio
    resolveHang();
    const done = await Promise.all(inflight);
    expect(done.every(d => d.status === 200)).toBe(true);
    await waitFor(() => uploadSemaphore.snapshot().global === 0);
    expect(uploadSemaphore.snapshot().global).toBe(0);
    await close();
  });
});
