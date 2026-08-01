// Log de erro SEGURO por allowlist. O vetor real: logar `error.cause` de uma
// falha do Drizzle despeja o SQL + os PARÂMETROS (CPF, telefone, e-mail, CNH)
// e a mensagem do driver nos logs do Railway. `error.message` de erros de
// conexão pode conter a string do banco (credencial). Aqui só extraímos o que
// IDENTIFICA a classe do erro — nome, código simbólico, errno — nunca valores.

export interface SafeError {
  name: string;
  code?: string;
  errno?: number;
}

// Código simbólico é seguro (ex.: ER_DUP_ENTRY, ECONNREFUSED); mensagens/valores
// não. Aceita só o formato de código (maiúsculas/dígitos/_), curto.
const SAFE_CODE_RE = /^[A-Z][A-Z0-9_]{0,40}$/;

function pick(o: Record<string, unknown>): SafeError {
  const name =
    typeof o.name === "string" && o.name ? o.name.slice(0, 60) : "Error";
  const out: SafeError = { name };
  if (typeof o.code === "string" && SAFE_CODE_RE.test(o.code))
    out.code = o.code;
  else if (typeof o.code === "number") out.code = String(o.code);
  if (typeof o.errno === "number") out.errno = o.errno;
  return out;
}

// Reduz QUALQUER erro a { name, code?, errno? }. Desembrulha UM nível de `cause`
// para pegar o código do driver (ER_*) quando o topo é um wrapper (Drizzle),
// mas NUNCA copia mensagem, sql, parameters ou o objeto cru.
export function toSafeLogError(e: unknown): SafeError {
  if (e === null || e === undefined) return { name: "null" };
  if (typeof e !== "object") return { name: typeof e };
  const o = e as Record<string, unknown>;
  const top = pick(o);
  // Se o topo não tem código útil e há um cause objeto, herda só o código dele.
  if (!top.code && o.cause && typeof o.cause === "object") {
    const inner = pick(o.cause as Record<string, unknown>);
    if (inner.code) top.code = inner.code;
    if (top.errno === undefined && inner.errno !== undefined)
      top.errno = inner.errno;
  }
  return top;
}
