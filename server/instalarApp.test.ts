import { describe, it, expect } from "vitest";
import {
  LINK_DOWNLOAD_APP,
  plataformaDoCelular,
} from "../client/src/lib/instalarApp";
import { ROTA_DOWNLOAD_APP } from "./_core/appMotorista";

// Instalação do app do motorista (24/11/2026).
describe("instalar o app do motorista", () => {
  it("o link do cartão é a MESMA rota que o servidor redireciona", () => {
    expect(LINK_DOWNLOAD_APP).toBe(ROTA_DOWNLOAD_APP);
  });

  it("reconhece Android, iPhone/iPad e o resto", () => {
    expect(
      plataformaDoCelular(
        "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36"
      )
    ).toBe("android");
    expect(
      plataformaDoCelular(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
      )
    ).toBe("ios");
    expect(
      plataformaDoCelular(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("ios");
    expect(
      plataformaDoCelular(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
      )
    ).toBe("outro");
    expect(
      plataformaDoCelular(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36"
      )
    ).toBe("outro");
  });
});
