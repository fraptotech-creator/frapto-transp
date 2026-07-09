// Exporta uma tabela como PDF SEM dependência nova: monta um HTML limpo num
// iframe oculto e chama print() → o usuário escolhe "Salvar como PDF".
// (iframe evita o bloqueador de pop-up do window.open.)

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c
  );

export function exportTablePDF(
  title: string,
  rows: Record<string, unknown>[]
): boolean {
  if (!rows || rows.length === 0) return false;
  const headers = Object.keys(rows[0]);
  const geradoEm = new Date().toLocaleString("pt-BR");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(
    title
  )}</title><style>
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111827}
    h1{font-size:18px;margin:0 0 2px}
    .meta{color:#6b7280;font-size:11px;margin-bottom:14px}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f3f4f6;font-weight:600}
    tr:nth-child(even) td{background:#fafafa}
    @media print{body{padding:0}}
  </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="meta">Frapto Transp · gerado em ${esc(geradoEm)}</div>
    <table><thead><tr>${headers
      .map(h => `<th>${esc(h)}</th>`)
      .join("")}</tr></thead><tbody>${rows
      .map(
        r => `<tr>${headers.map(h => `<td>${esc(r[h])}</td>`).join("")}</tr>`
      )
      .join("")}</tbody></table>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Dá um tempo pro layout montar antes de imprimir; remove o iframe depois.
  win.focus();
  window.setTimeout(() => {
    win.print();
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  }, 300);
  return true;
}
