import { describe, it, expect } from "vitest";
import { modoInicialAuth } from "../client/src/lib/modoInicialAuth";

// Trava do teste pré-venda 23/11/2026: /login?error=... abria a landing e o
// aviso de falha do Google ficava escondido.
describe("modoInicialAuth", () => {
  it("/login abre direto a tela de entrar", () => {
    expect(modoInicialAuth("/login", "")).toBe("login");
    expect(modoInicialAuth("/login", "?error=google_conta_senha")).toBe(
      "login"
    );
  });

  it("qualquer página com ?error= também", () => {
    expect(modoInicialAuth("/", "?error=google_state")).toBe("login");
  });

  it("raiz sem erro mostra a landing", () => {
    expect(modoInicialAuth("/", "")).toBeNull();
    expect(modoInicialAuth("/dashboard", "?x=1")).toBeNull();
  });
});
