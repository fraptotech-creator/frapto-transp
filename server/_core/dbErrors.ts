// Traduz erros CRUS do driver MySQL (ex.: chave duplicada) em mensagens claras
// para o usuário — SEM vazar SQL nem o schema do banco.
//
// Função PURA (recebe o erro, devolve o texto ou null): fácil de testar em 1ms.
// O drizzle embrulha o erro do mysql2 num `DrizzleQueryError` cujo `.cause` é o
// erro original; por isso percorremos a cadeia de `cause`.

type MaybeDbError = {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  cause?: unknown;
};

// Mapeia o índice único violado (pelo nome/campo que aparece na mensagem crua
// do mysql2, ex.: "for key 'vehicles.placa_org_unique'") numa frase amigável.
const DUP_FIELD_MESSAGES: { key: RegExp; message: string }[] = [
  {
    key: /placa/i,
    message: "Já existe um veículo com essa placa nesta empresa.",
  },
  {
    key: /cpf/i,
    message: "Já existe um motorista com esse CPF nesta empresa.",
  },
  {
    key: /cnh/i,
    message: "Já existe um motorista com essa CNH nesta empresa.",
  },
  {
    key: /(numero.?viagem|viagem)/i,
    message: "Já existe uma viagem com esse número nesta empresa.",
  },
  { key: /email/i, message: "Esse e-mail já está em uso." },
];

// Coleta a cadeia error → error.cause → … (com teto de profundidade).
function collectChain(error: unknown): MaybeDbError[] {
  const chain: MaybeDbError[] = [];
  let cur = error as MaybeDbError | undefined;
  for (let depth = 0; depth < 8 && cur && typeof cur === "object"; depth++) {
    chain.push(cur);
    cur = (cur as MaybeDbError).cause as MaybeDbError | undefined;
  }
  return chain;
}

/**
 * Se o erro for de chave duplicada (ER_DUP_ENTRY / errno 1062, ou a mensagem
 * crua contém "Duplicate entry"), devolve uma frase clara em pt-BR indicando
 * QUAL campo colidiu. Caso contrário, devolve null (não é duplicado).
 */
export function friendlyDbErrorMessage(error: unknown): string | null {
  const chain = collectChain(error);
  const isDup = chain.some(
    e =>
      e.code === "ER_DUP_ENTRY" ||
      e.errno === 1062 ||
      (typeof e.message === "string" && /duplicate entry/i.test(e.message))
  );
  if (!isDup) return null;

  const allMessages = chain
    .map(e => (typeof e.message === "string" ? e.message : ""))
    .join(" ");
  const hit = DUP_FIELD_MESSAGES.find(d => d.key.test(allMessages));
  return (
    hit?.message ?? "Registro duplicado: já existe um item com esses dados."
  );
}
