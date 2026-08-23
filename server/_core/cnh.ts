// Situação da CNH — decisão PURA (entra data + agora, sai flag), testável em 1ms.
// A IA/LLM é ruim em comparar datas e não sabe "hoje"; então o servidor computa
// o vencimento e entrega pronto, em vez de deixar o modelo raciocinar sobre isso.

export type CnhSituacao = {
  vencida: boolean;
  // Dias até vencer (negativo = já venceu há N dias). null se sem data.
  diasParaVencer: number | null;
};

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function cnhSituacao(
  cnhVencimento: Date | string | null | undefined,
  agora: Date
): CnhSituacao {
  if (!cnhVencimento) return { vencida: false, diasParaVencer: null };
  const venc = new Date(cnhVencimento);
  if (Number.isNaN(venc.getTime())) {
    return { vencida: false, diasParaVencer: null };
  }
  const ms = venc.getTime() - agora.getTime();
  return {
    vencida: ms < 0,
    diasParaVencer: Math.ceil(ms / UM_DIA_MS),
  };
}
