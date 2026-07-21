import { describe, expect, it } from "vitest";
import { podeVerItem } from "../client/src/lib/menuAccess";

const COMUM = {};
const ADMIN_ORG = { adminOnly: true };
const PLATAFORMA = { superAdminOnly: true };

describe("podeVerItem", () => {
  it("item comum aparece para qualquer usuário da empresa", () => {
    expect(podeVerItem(COMUM, { orgRole: "member" })).toBe(true);
    expect(podeVerItem(COMUM, { orgRole: "owner" })).toBe(true);
  });

  it("item adminOnly só para dono da empresa (ou admin)", () => {
    expect(podeVerItem(ADMIN_ORG, { orgRole: "owner" })).toBe(true);
    expect(podeVerItem(ADMIN_ORG, { role: "admin" })).toBe(true);
    expect(podeVerItem(ADMIN_ORG, { orgRole: "member" })).toBe(false);
  });

  it("item da plataforma só para o super-admin", () => {
    expect(podeVerItem(PLATAFORMA, { isSuperAdmin: true })).toBe(true);
    // Dono de empresa NÃO é dono da plataforma.
    expect(podeVerItem(PLATAFORMA, { orgRole: "owner" })).toBe(false);
    expect(podeVerItem(PLATAFORMA, { role: "admin" })).toBe(false);
    expect(podeVerItem(PLATAFORMA, {})).toBe(false);
  });

  it("super-admin sem assinatura vê SÓ a área da plataforma", () => {
    const v = { isSuperAdmin: true, orgRole: "owner", somentePlataforma: true };
    expect(podeVerItem(PLATAFORMA, v)).toBe(true);
    expect(podeVerItem(COMUM, v)).toBe(false);
    expect(podeVerItem(ADMIN_ORG, v)).toBe(false);
  });

  it("somentePlataforma não vira brecha para quem não é super-admin", () => {
    // Mesmo se o modo ligasse por engano, item da plataforma exige a flag.
    expect(
      podeVerItem(COMUM, { orgRole: "owner", somentePlataforma: true })
    ).toBe(false);
  });
});
