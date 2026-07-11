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

// Mapeia o NOME do índice único violado (que o mysql2 informa em
// "for key '<nome>'", ex.: "drivers_cnh_por_org") numa frase amigável.
// IMPORTANTE: casamos só no nome do índice — NÃO na mensagem inteira. O wrapper
// do drizzle lista todas as colunas do INSERT ("... `cpf`, `cnh` ..."), então
// casar na mensagem toda daria falso-positivo (dizia "CPF" para colisão de CNH).
const DUP_FIELD_MESSAGES: { key: RegExp; message: string }[] = [
  {
    key: /placa/i,
    message: "Já existe um veículo com essa placa nesta empresa.",
  },
  {
    key: /telefone/i,
    message: "Já existe um motorista com esse telefone nesta empresa.",
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
    key: /numero/i,
    message: "Já existe uma viagem com esse número nesta empresa.",
  },
  { key: /username/i, message: "Esse usuário já está em uso. Escolha outro." },
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

// Extrai o nome do índice de "for key '...'" (só o mysql2 traz isso; o wrapper
// do drizzle não). Devolve "" se não achar.
function extractKeyName(messages: string): string {
  const m = messages.match(/for key ['"`]([^'"`]+)['"`]/i);
  return m ? m[1] : "";
}

/**
 * Se o erro for de chave duplicada (ER_DUP_ENTRY / errno 1062, ou a mensagem
 * crua contém "Duplicate entry"), devolve uma frase clara em pt-BR indicando
 * QUAL campo colidiu (pelo NOME do índice). Caso contrário, devolve null.
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
  const keyName = extractKeyName(allMessages);
  const hit = keyName
    ? DUP_FIELD_MESSAGES.find(d => d.key.test(keyName))
    : undefined;
  return (
    hit?.message ?? "Registro duplicado: já existe um item com esses dados."
  );
}
