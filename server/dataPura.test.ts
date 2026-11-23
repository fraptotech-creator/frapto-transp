import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anoMesPuro,
  dataPura,
  formatarDataPura,
} from "../client/src/lib/dataPura";

// Força o fuso do Brasil: no CI (UTC) o bug não aparece sozinho. O Node aplica
// mudança de process.env.TZ em tempo de execução.
const tzOriginal = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = tzOriginal;
});

describe("dataPura (trava do bug 'um dia a menos', 23/11/2026)", () => {
  // Como o formulário grava: new Date("2027-01-10") = meia-noite UTC.
  const crlv = new Date("2027-01-10");

  it("pré-condição: no fuso de SP o jeito antigo mostrava o dia anterior", () => {
    expect(crlv.toLocaleDateString("pt-BR")).toBe("09/01/2027");
  });

  it("formatarDataPura mostra o dia digitado", () => {
    expect(formatarDataPura(crlv)).toBe("10/01/2027");
    expect(formatarDataPura("2026-12-01T00:00:00.000Z")).toBe("01/12/2026");
  });

  it("dataPura devolve meia-noite LOCAL do mesmo dia (para date-fns)", () => {
    const d = dataPura(crlv) as Date;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([
      2027, 1, 10,
    ]);
    expect(d.getHours()).toBe(0);
  });

  it("anoMesPuro não escorrega para o mês anterior no dia 1º", () => {
    expect(anoMesPuro(new Date("2026-12-01"))).toBe("2026-12");
  });

  it("vazio/inválido não quebra", () => {
    for (const v of [null, undefined, "", "lixo"]) {
      expect(formatarDataPura(v)).toBe("");
      expect(dataPura(v)).toBeNull();
      expect(anoMesPuro(v)).toBe("");
    }
  });
});
