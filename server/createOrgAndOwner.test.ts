import { describe, expect, it } from "vitest";
import {
  createOrgAndOwnerCore,
  type OrgOwnerExecutor,
  type CreateOrgAndOwnerParams,
} from "./db/organizations";

// Fake que modela a tabela organizations com auto-increment e a users, para
// exercitar a semântica de concorrência SEM banco real.
function fakeStore() {
  let seq = 0;
  const users: { openId: string; orgId: number }[] = [];
  return { users, nextId: () => ++seq };
}

// Executor que insere org e, ANTES de inserir o dono, cede o controle (await)
// — forçando o interleaving de dois cadastros simultâneos. É exatamente a
// janela em que o bug antigo (ORDER BY id DESC) ligava o dono à org errada.
function execComInterleaving(
  store: ReturnType<typeof fakeStore>
): OrgOwnerExecutor {
  return {
    async insertOrg() {
      const id = store.nextId();
      await Promise.resolve(); // ponto de troca de contexto
      return id;
    },
    async insertOwner(orgId, params) {
      await Promise.resolve();
      store.users.push({ openId: params.openId, orgId });
    },
  };
}

const base = (openId: string, orgName: string): CreateOrgAndOwnerParams => ({
  orgName,
  openId,
  email: `${openId}@x.com`,
  passwordHash: "hash",
  name: null,
});

describe("createOrgAndOwnerCore", () => {
  it("liga o dono à org retornada pelo insert, não ao 'último registro'", async () => {
    const store = fakeStore();
    const orgId = await createOrgAndOwnerCore(
      execComInterleaving(store),
      base("a", "Empresa A")
    );
    expect(store.users).toEqual([{ openId: "a", orgId }]);
  });

  it("dois cadastros CONCORRENTES não trocam de organização", async () => {
    // O bug real: sob concorrência, o dono B era ligado à org de A (ou vice-
    // versa). Aqui rodamos os dois interleaved e exigimos org própria p/ cada.
    const store = fakeStore();
    const [idA, idB] = await Promise.all([
      createOrgAndOwnerCore(execComInterleaving(store), base("a", "A")),
      createOrgAndOwnerCore(execComInterleaving(store), base("b", "B")),
    ]);
    expect(idA).not.toBe(idB);
    const donoA = store.users.find(u => u.openId === "a");
    const donoB = store.users.find(u => u.openId === "b");
    expect(donoA?.orgId).toBe(idA);
    expect(donoB?.orgId).toBe(idB);
  });

  it("falha ao criar o dono PROPAGA o erro (transação faz rollback da org)", async () => {
    const exec: OrgOwnerExecutor = {
      async insertOrg() {
        return 1;
      },
      async insertOwner() {
        throw new Error("email duplicado");
      },
    };
    await expect(createOrgAndOwnerCore(exec, base("a", "A"))).rejects.toThrow(
      "email duplicado"
    );
    // O núcleo não engole o erro nem retorna sucesso parcial — quem envolve
    // em db.transaction desfaz o insert da org.
  });

  it("nunca insere o dono se o insert da org falhar", async () => {
    let ownerInserts = 0;
    const exec: OrgOwnerExecutor = {
      async insertOrg() {
        throw new Error("falha no insert da org");
      },
      async insertOwner() {
        ownerInserts++;
      },
    };
    await expect(createOrgAndOwnerCore(exec, base("a", "A"))).rejects.toThrow();
    expect(ownerInserts).toBe(0);
  });
});
