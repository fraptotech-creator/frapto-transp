import { describe, expect, it } from "vitest";
import {
  voltouDoCheckout,
  estadoRetorno,
  podeAssinar,
  LIMITE_ESPERA_MS,
} from "../client/src/lib/checkoutRetorno";

describe("voltouDoCheckout", () => {
  it("reconhece só o retorno de sucesso", () => {
    expect(voltouDoCheckout("?checkout=success")).toBe(true);
    expect(voltouDoCheckout("?checkout=cancel")).toBe(false);
    expect(voltouDoCheckout("")).toBe(false);
    expect(voltouDoCheckout("?outro=1")).toBe(false);
  });
});

describe("estadoRetorno", () => {
  const base = { voltouDoCheckout: true, assinaturaAtiva: false };

  it("logo após pagar, fica AGUARDANDO o webhook", () => {
    expect(estadoRetorno({ ...base, msDesdeRetorno: 0 })).toBe("aguardando");
    expect(
      estadoRetorno({ ...base, msDesdeRetorno: LIMITE_ESPERA_MS - 1 })
    ).toBe("aguardando");
  });

  it("passado o limite, admite que DEMOROU em vez de deixar no vazio", () => {
    expect(estadoRetorno({ ...base, msDesdeRetorno: LIMITE_ESPERA_MS })).toBe(
      "demorou"
    );
  });

  it("quem não veio do checkout segue no fluxo normal", () => {
    expect(
      estadoRetorno({
        voltouDoCheckout: false,
        assinaturaAtiva: false,
        msDesdeRetorno: 0,
      })
    ).toBe("normal");
  });

  it("assinatura já ativa não é caso de espera", () => {
    expect(
      estadoRetorno({ ...base, assinaturaAtiva: true, msDesdeRetorno: 0 })
    ).toBe("normal");
  });
});

describe("podeAssinar", () => {
  it("BLOQUEIA novo checkout enquanto aguarda — evita cobrança dupla", () => {
    // Este é o teste que representa o bug real: cliente pagou, webhook ainda
    // não chegou, e o botão "Assinar" abriria uma SEGUNDA assinatura.
    expect(podeAssinar("aguardando")).toBe(false);
    expect(podeAssinar("demorou")).toBe(false);
  });

  it("permite assinar no fluxo normal", () => {
    expect(podeAssinar("normal")).toBe(true);
  });
});
