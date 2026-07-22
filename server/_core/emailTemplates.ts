// Conteúdo dos e-mails. Separado do envio para ser testável sem rede.

const escapar = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * E-mail de recuperação de senha.
 *
 * Manda versão HTML e texto puro: cliente de e-mail que bloqueia HTML (comum
 * em corporativo) ainda mostra o link, e ter as duas versões melhora a
 * entrega — mensagem só-HTML tem mais cara de spam.
 */
export function emailRecuperacaoSenha(p: {
  link: string;
  validadeHoras: number;
}) {
  const link = escapar(p.link);
  return {
    assunto: "Redefinir sua senha — Frapto Transp",
    texto: [
      "Você pediu para redefinir a senha do Frapto Transp.",
      "",
      `Abra este link para criar uma nova senha: ${p.link}`,
      "",
      `O link vale por ${p.validadeHoras} hora(s) e só pode ser usado uma vez.`,
      "",
      "Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.",
    ].join("\n"),
    html: `
<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px">Redefinir sua senha</h1>
  <p style="margin:0 0 16px;line-height:1.6">
    Você pediu para redefinir a senha do <strong>Frapto Transp</strong>.
  </p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
      Criar nova senha
    </a>
  </p>
  <p style="margin:0 0 16px;line-height:1.6;font-size:14px;color:#475569">
    O link vale por ${p.validadeHoras} hora(s) e só pode ser usado uma vez.
    Se o botão não funcionar, copie e cole no navegador:<br>
    <span style="word-break:break-all">${link}</span>
  </p>
  <p style="margin:0;line-height:1.6;font-size:14px;color:#475569">
    Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.
  </p>
</div>`.trim(),
  };
}
