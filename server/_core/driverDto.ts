import type { Driver } from "../../drizzle/schema";

// DTOs de motorista — decidem o que sai para o browser. PUROS e testáveis.
//
// Regra: o trackingToken (e hash/expiração/rotação/revogação) é uma CREDENCIAL —
// NUNCA vai ao browser, nem para o dono. A PII (CPF/CNH/telefone/e-mail/endereço)
// só sai no DTO de DONO (activeOrgOwnerProcedure); o DTO operacional (member) traz
// apenas o necessário para operar frota (atribuir viagem, alertas de CNH).

// Campos de credencial de rastreio — jamais serializados ao cliente.
const TOKEN_FIELDS = [
  "trackingToken",
  "trackingTokenHash",
  "trackingTokenExpiresAt",
  "trackingTokenRotatedAt",
  "trackingTokenRevokedAt",
] as const;

export interface DriverPublic {
  id: number;
  orgId: number;
  nome: string;
  status: Driver["status"];
  disponibilidade: boolean;
  cnhCategoria: string;
  cnhVencimento: Date;
  dataAdmissao: Date;
  createdAt: Date;
  updatedAt: Date;
}

// DTO OPERACIONAL (member): sem PII e sem credencial. Suficiente para atribuir
// motorista a uma viagem e para o alerta de vencimento de CNH.
export function toDriverPublic(d: Driver): DriverPublic {
  return {
    id: d.id,
    orgId: d.orgId,
    nome: d.nome,
    status: d.status,
    disponibilidade: d.disponibilidade,
    cnhCategoria: d.cnhCategoria,
    cnhVencimento: d.cnhVencimento,
    dataAdmissao: d.dataAdmissao,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

// DTO de DONO: PII incluída (cadastro/edição), mas AINDA sem a credencial de
// rastreio (token/hash/expiração/rotação/revogação nunca vão ao browser).
export type DriverPii = Omit<Driver, (typeof TOKEN_FIELDS)[number]>;

export function toDriverPii(d: Driver): DriverPii {
  const rest = { ...d } as Record<string, unknown>;
  for (const f of TOKEN_FIELDS) delete rest[f];
  return rest as DriverPii;
}
