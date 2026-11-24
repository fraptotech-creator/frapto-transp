import { describe, it, expect } from "vitest";
import {
  BASE,
  agoraParaInput,
  chegadaParaIso,
  configRastreio,
  mensagemDeErro,
  rastreioDeveEstarAtivo,
  wazeUrl,
} from "../mobile/src/logica.js";
import { wazeUrl as wazeUrlDoSite } from "../client/src/lib/nav";
import { TRACK_TOKEN_RE } from "./_core/trackIngest";

// Regras puras do APP NATIVO do motorista (mobile/src/logica.js), 24/11/2026.
describe("app do motorista — regras puras", () => {
  it("GPS ligado só com viagem EM ANDAMENTO", () => {
    expect(rastreioDeveEstarAtivo([])).toBe(false);
    expect(rastreioDeveEstarAtivo(undefined)).toBe(false);
    expect(rastreioDeveEstarAtivo([{ status: "planejada" }])).toBe(false);
    expect(
      rastreioDeveEstarAtivo([
        { status: "planejada" },
        { status: "em_andamento" },
      ])
    ).toBe(true);
  });

  it("config do plugin: POST nativo no /api/track com o token no Bearer", () => {
    const tk = "f".repeat(48);
    const c = configRastreio(tk);
    expect(c.url).toBe(`${BASE}/api/track`);
    expect(c.headers.Authorization).toBe(`Bearer ${tk}`);
    // O servidor aceita exatamente este formato de cabeçalho.
    expect(TRACK_TOKEN_RE.test(c.headers.Authorization.slice(7))).toBe(true);
    // backgroundMessage é o que mantém o GPS com o app em segundo plano.
    expect(c.backgroundMessage).toBeTruthy();
    expect(c.requestPermissions).toBe(true);
  });

  it("aponta para o domínio próprio de produção (https)", () => {
    expect(BASE).toBe("https://www.fraptotransp.com.br");
  });

  it("link do Waze igual ao do site", () => {
    expect(wazeUrl("Av. Vitória, 100 - Vitória/ES")).toBe(
      wazeUrlDoSite("Av. Vitória, 100 - Vitória/ES")
    );
  });

  it("hora de chegada: input local → ISO; inválida → null", () => {
    const local = agoraParaInput(new Date(2026, 10, 24, 15, 7));
    expect(local).toBe("2026-11-24T15:07");
    expect(chegadaParaIso(local)).toBe(
      new Date(2026, 10, 24, 15, 7).toISOString()
    );
    expect(chegadaParaIso("")).toBeNull();
    expect(chegadaParaIso("ontem")).toBeNull();
  });

  it("mensagens de erro legíveis para o motorista", () => {
    expect(mensagemDeErro(401, "x")).toMatch(/Entre de novo/);
    expect(mensagemDeErro(403, "SUBSCRIPTION_REQUIRED")).toMatch(
      /assinatura da empresa/
    );
    expect(mensagemDeErro(403, "PASSWORD_CHANGE_REQUIRED")).toMatch(
      /Defina a sua senha/
    );
    expect(mensagemDeErro(404, "Viagem não encontrada.")).toBe(
      "Viagem não encontrada."
    );
    expect(mensagemDeErro(500, "")).toMatch(/erro 500/);
  });
});
