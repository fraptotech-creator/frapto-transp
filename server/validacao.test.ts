import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  anoValido,
  cpfSchema,
  cpfValido,
  mensagemDeValidacao,
  texto,
} from "./_core/validacao";
import { appRouter } from "./routers";

describe("mensagemDeValidacao (trava: tela mostrava o JSON cru do zod)", () => {
  it("pega a 1ª mensagem do ZodError", () => {
    const r = z.object({ cpf: cpfSchema }).safeParse({ cpf: "123" });
    expect(mensagemDeValidacao(r.error)).toBe(
      "CPF inválido: confira os números."
    );
  });
  it("sem issues → null (não inventa mensagem)", () => {
    expect(mensagemDeValidacao(new Error("x"))).toBeNull();
    expect(mensagemDeValidacao(null)).toBeNull();
    expect(mensagemDeValidacao({ issues: [] })).toBeNull();
  });
  it("o tRPC entrega o erro de input com `issues` na cause", async () => {
    // Confirma o contrato que o errorFormatter usa (versão real do tRPC).
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} },
      res: {},
    } as never);
    const err = await caller.auth
      .login({ email: "nao-e-email", password: "" } as never)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(mensagemDeValidacao((err as TRPCError).cause)).toEqual(
      expect.any(String)
    );
  });
});

describe("cpfValido (trava: 123.456.789-00 era aceito ao vivo)", () => {
  it("aceita CPF válido com e sem máscara", () => {
    expect(cpfValido("111.444.777-35")).toBe(true);
    expect(cpfValido("11144477735")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
  });
  it("rejeita dígito verificador errado", () => {
    expect(cpfValido("123.456.789-00")).toBe(false);
    expect(cpfValido("111.444.777-36")).toBe(false);
  });
  it("rejeita sequência repetida, tamanho errado e vazio", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("1234567890")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });
  it("schema devolve mensagem em português", () => {
    const r = cpfSchema.safeParse("123.456.789-00");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/CPF inválido/);
  });
});

describe("anoValido (trava: 1800 e 3000 eram aceitos ao vivo)", () => {
  const agora = new Date("2026-11-23T12:00:00Z");
  it("aceita de 1950 até o ano que vem", () => {
    expect(anoValido(1950, agora)).toBe(true);
    expect(anoValido(2026, agora)).toBe(true);
    expect(anoValido(2027, agora)).toBe(true);
  });
  it("rejeita fora da faixa e não-inteiro", () => {
    expect(anoValido(1800, agora)).toBe(false);
    expect(anoValido(3000, agora)).toBe(false);
    expect(anoValido(2028, agora)).toBe(false);
    expect(anoValido(2020.5, agora)).toBe(false);
  });
});

describe("texto(max) (trava: texto longo virava erro 500)", () => {
  it("passa no limite e recusa acima com mensagem clara", () => {
    const s = texto(50, "Modelo");
    expect(s.safeParse("M".repeat(50)).success).toBe(true);
    const r = s.safeParse("M".repeat(51));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Modelo: no máximo 50 caracteres.");
  });
});
