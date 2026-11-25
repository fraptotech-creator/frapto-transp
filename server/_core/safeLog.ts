// Log de erro SEGURO por allowlist. O vetor real: logar `error.cause` de uma
// falha do Drizzle despeja o SQL + os PARÂMETROS (CPF, telefone, e-mail, CNH)
// e a mensagem do driver nos logs do Railway. `error.message` de erros de
// conexão pode conter a string do banco (credencial). Aqui só extraímos o que
// IDENTIFICA a classe do erro — nome, código simbólico, errno — nunca valores.

export interface SafeError {
  name: string;
  // Status HTTP de erro de API externa (SDK OpenAI/Groq/Anthropic, Stripe...).
  status?: number;
  code?: string;
  // Tipo simbólico do erro do provedor (ex.: invalid_request_error).
  type?: string;
  errno?: number;
}

// Código simbólico é seguro (ex.: ER_DUP_ENTRY, ECONNREFUSED); mensagens/valores
// não. Aceita só o formato de código (maiúsculas/dígitos/_), curto.
const SAFE_CODE_RE = /^[A-Z][A-Z0-9_]{0,40}$/;
// Código de provedor em snake_case minúsculo (tool_use_failed,
// rate_limit_exceeded). Exige ao menos um "_": palavra solta ("joao") poderia
// ser um valor, identificador snake_case não. Sem espaço, "@", "." nem dígito
// inicial — CPF/telefone/e-mail não casam.
const SAFE_SNAKE_RE = /^(?=.{3,41}$)[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

const simbolo = (v: unknown): string | undefined =>
  typeof v === "string" && (SAFE_CODE_RE.test(v) || SAFE_SNAKE_RE.test(v))
    ? v
    : undefined;

function pick(o: Record<string, unknown>): SafeError {
  const name =
    typeof o.name === "string" && o.name ? o.name.slice(0, 60) : "Error";
  const out: SafeError = { name };
  if (
    typeof o.status === "number" &&
    Number.isInteger(o.status) &&
    o.status >= 100 &&
    o.status <= 599
  )
    out.status = o.status;
  const code = simbolo(o.code);
  if (code) out.code = code;
  else if (typeof o.code === "number") out.code = String(o.code);
  const type = simbolo(o.type);
  if (type) out.type = type;
  if (typeof o.errno === "number") out.errno = o.errno;
  return out;
}

// Reduz QUALQUER erro a { name, status?, code?, type?, errno? }. Desembrulha UM nível de `cause`
// para pegar o código do driver (ER_*) quando o topo é um wrapper (Drizzle),
// mas NUNCA copia mensagem, sql, parameters ou o objeto cru.
export function toSafeLogError(e: unknown): SafeError {
  if (e === null || e === undefined) return { name: "null" };
  if (typeof e !== "object") return { name: typeof e };
  const o = e as Record<string, unknown>;
  const top = pick(o);
  // Se o topo é um wrapper (Drizzle, TRPCError) e há um cause objeto, herda
  // só os campos SIMBÓLICOS que faltam no topo (código, status, tipo, errno).
  if (o.cause && typeof o.cause === "object") {
    const inner = pick(o.cause as Record<string, unknown>);
    if (!top.code && inner.code) top.code = inner.code;
    if (top.status === undefined && inner.status !== undefined)
      top.status = inner.status;
    if (!top.type && inner.type) top.type = inner.type;
    if (top.errno === undefined && inner.errno !== undefined)
      top.errno = inner.errno;
  }
  return top;
}
