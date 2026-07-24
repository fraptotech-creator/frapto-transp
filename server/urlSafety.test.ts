import { describe, it, expect } from "vitest";
import {
  isPrivateIp,
  assertSafeBaseUrl,
  classifyBaseUrl,
} from "./_core/urlSafety";

describe("isPrivateIp", () => {
  it("bloqueia loopback/privados/metadata/CGNAT", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.1",
      "172.16.0.1",
      "169.254.169.254", // metadata cloud
      "100.100.0.1", // CGNAT
      "::1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("permite IPs públicos", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "34.201.1.1"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("bloqueia broadcast, multicast e reservados (IPv4)", () => {
    for (const ip of ["255.255.255.255", "224.0.0.1", "240.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("bloqueia IPv6 interno (unique-local, link-local, IPv4 mapeado)", () => {
    for (const ip of [
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "feb0::1",
      "::ffff:169.254.169.254", // metadata via IPv4 mapeado
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("permite IPv6 público", () => {
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });
});

describe("classifyBaseUrl (puro, sem DNS)", () => {
  it("bloqueia http, localhost e IP interno literal", () => {
    for (const u of [
      "http://api.openai.com",
      "https://localhost/v1",
      "https://x.internal/v1",
      "https://169.254.169.254/latest",
      "https://[::1]/v1",
    ]) {
      expect(classifyBaseUrl(u), u).toMatchObject({ bloqueado: true });
    }
  });
  it("aprova host público (DNS fica para assertSafeBaseUrl)", () => {
    expect(classifyBaseUrl("https://api.openai.com/v1")).toMatchObject({
      bloqueado: false,
    });
  });
});

describe("SSRF vale para QUALQUER provider (nao so openai_compatible)", () => {
  it("baseUrl interno e rejeitado independentemente do provider", async () => {
    // O runtime usa baseUrl tambem no provider 'openai'; antes so o
    // openai_compatible era validado. A protecao agora e por baseUrl.
    await expect(
      assertSafeBaseUrl("https://169.254.169.254/v1")
    ).rejects.toThrow(/interno/);
  });
});

describe("assertSafeBaseUrl (SSRF)", () => {
  it("rejeita não-https", async () => {
    await expect(assertSafeBaseUrl("http://api.exemplo.com")).rejects.toThrow(
      /https/
    );
  });
  it("rejeita IP interno literal", async () => {
    await expect(
      assertSafeBaseUrl("https://169.254.169.254/latest")
    ).rejects.toThrow(/interno/);
    await expect(assertSafeBaseUrl("https://127.0.0.1")).rejects.toThrow(
      /interno/
    );
  });
  it("rejeita localhost", async () => {
    await expect(assertSafeBaseUrl("https://localhost/v1")).rejects.toThrow(
      /permitido/
    );
  });
  it("aceita IP público literal", async () => {
    await expect(
      assertSafeBaseUrl("https://8.8.8.8/v1")
    ).resolves.toBeUndefined();
  });
});
