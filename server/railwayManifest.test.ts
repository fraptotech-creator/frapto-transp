import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Validação DETERMINÍSTICA (offline, sem rede) do railway.json contra os valores
// oficiais do schema da Railway. Enums são case-sensitive MAIÚSCULOS — um valor
// minúsculo (ex.: "dockerfile"/"on_failure") não é reconhecido pelo schema e o
// build/restart cairia no default silenciosamente.
const BUILDERS = ["NIXPACKS", "DOCKERFILE", "RAILPACK", "HEROKU", "PAKETO"];
const RESTART = ["ON_FAILURE", "ALWAYS", "NEVER"];

describe("railway.json — manifesto válido (item 4)", () => {
  const raw = readFileSync(path.resolve(process.cwd(), "railway.json"), "utf8");

  it("é JSON válido", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  const cfg = JSON.parse(raw) as {
    build?: { builder?: string; dockerfilePath?: string };
    deploy?: {
      restartPolicyType?: string;
      healthcheckPath?: string;
      drainingSeconds?: number;
      restartPolicyMaxRetries?: number;
    };
  };

  it("build.builder é um enum oficial (DOCKERFILE)", () => {
    expect(BUILDERS).toContain(cfg.build?.builder);
    expect(cfg.build?.builder).toBe("DOCKERFILE");
    expect(cfg.build?.dockerfilePath).toBe("Dockerfile");
  });

  it("deploy.restartPolicyType é um enum oficial (ON_FAILURE)", () => {
    expect(RESTART).toContain(cfg.deploy?.restartPolicyType);
    expect(cfg.deploy?.restartPolicyType).toBe("ON_FAILURE");
  });

  it("healthcheck aponta para /api/ready (readiness) e há drainingSeconds", () => {
    expect(cfg.deploy?.healthcheckPath).toBe("/api/ready");
    expect(typeof cfg.deploy?.drainingSeconds).toBe("number");
    expect(cfg.deploy?.drainingSeconds).toBeGreaterThan(0);
  });
});
