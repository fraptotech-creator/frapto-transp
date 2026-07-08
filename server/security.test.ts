import { describe, it, expect, vi } from "vitest";

// ENV com appBaseUrl fixo para testar a checagem de Origin.
vi.mock("./_core/env", () => ({
  ENV: {
    appBaseUrl: "https://app.test",
    stripeSecretKey: "",
    stripePriceId: "",
  },
}));

import { originCheck, securityHeaders } from "./_core/security";

type Res = {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
  status: (c: number) => Res;
  json: (b: unknown) => Res;
  setHeader: (k: string, v: string) => void;
  removeHeader: (k: string) => void;
};
const mkRes = (): Res => {
  const res: Res = {
    headers: {},
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    removeHeader(k) {
      delete this.headers[k.toLowerCase()];
    },
  };
  return res;
};

describe("originCheck (CSRF)", () => {
  it("nega Origin que não bate com APP_BASE_URL", () => {
    const req = { headers: { origin: "https://evil.com" } } as never;
    const res = mkRes();
    const next = vi.fn();
    originCheck(req, res as never, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("permite Origin igual ao APP_BASE_URL", () => {
    const req = { headers: { origin: "https://app.test" } } as never;
    const res = mkRes();
    const next = vi.fn();
    originCheck(req, res as never, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it("permite requisição sem Origin (server-to-server)", () => {
    const req = { headers: {} } as never;
    const res = mkRes();
    const next = vi.fn();
    originCheck(req, res as never, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("securityHeaders", () => {
  it("seta anti-clickjacking e nosniff", () => {
    const req = { headers: {}, protocol: "http" } as never;
    const res = mkRes();
    const next = vi.fn();
    securityHeaders(req, res as never, next);
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(next).toHaveBeenCalled();
  });
});
