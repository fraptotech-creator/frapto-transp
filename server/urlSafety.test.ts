import { describe, it, expect } from "vitest";
import { isPrivateIp, assertSafeBaseUrl } from "./_core/urlSafety";

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
