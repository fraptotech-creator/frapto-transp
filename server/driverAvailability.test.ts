import { describe, it, expect } from "vitest";
import { resolverDisponibilidade, cnhVencida } from "@/lib/driverAvailability";

const AGORA = new Date("2026-06-01T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const emDias = (n: number) => new Date(AGORA.getTime() + n * DIA);

const base = {
  status: "disponivel",
  disponibilidade: true,
  cnhVencimento: emDias(30),
};

describe("resolverDisponibilidade — CNH vencida manda", () => {
  it("CNH vencida → Indisponível (mesmo com status disponível e flag on)", () => {
    const r = resolverDisponibilidade(
      { ...base, cnhVencimento: emDias(-1) },
      AGORA
    );
    expect(r.disponivel).toBe(false);
    expect(r.rotulo).toBe("Indisponível");
    expect(r.motivo).toBe("CNH vencida");
    expect(r.chaveCor).toBe("indisponivel");
  });

  it("CNH válida + status disponível + flag on → Disponível", () => {
    const r = resolverDisponibilidade(base, AGORA);
    expect(r.disponivel).toBe(true);
    expect(r.rotulo).toBe("Disponível");
    expect(r.motivo).toBeNull();
  });

  it("CNH nula não bloqueia (fail-open só nesse campo ausente)", () => {
    expect(cnhVencida(null, AGORA)).toBe(false);
    expect(
      resolverDisponibilidade({ ...base, cnhVencimento: null }, AGORA)
        .disponivel
    ).toBe(true);
  });
});

describe("resolverDisponibilidade — flag manual e status", () => {
  it("flag manual desligada → Indisponível (sem motivo de CNH)", () => {
    const r = resolverDisponibilidade(
      { ...base, disponibilidade: false },
      AGORA
    );
    expect(r.disponivel).toBe(false);
    expect(r.rotulo).toBe("Indisponível");
    expect(r.motivo).toBeNull();
  });

  it("status operacional é refletido quando CNH ok e flag on", () => {
    for (const [status, rotulo] of [
      ["viagem", "Em viagem"],
      ["descansando", "Descansando"],
      ["inativo", "Inativo"],
    ] as const) {
      const r = resolverDisponibilidade({ ...base, status }, AGORA);
      expect(r.disponivel).toBe(false);
      expect(r.rotulo).toBe(rotulo);
      expect(r.chaveCor).toBe(status);
    }
  });

  it("CNH vencida tem prioridade sobre status/flag", () => {
    const r = resolverDisponibilidade(
      { status: "viagem", disponibilidade: false, cnhVencimento: emDias(-5) },
      AGORA
    );
    expect(r.motivo).toBe("CNH vencida");
  });
});
