// Links de navegação externa (grátis, sem chave, sem billing).
// Waze deep link: abre o app do Waze já navegando até o endereço (ou a web,
// se o app não estiver instalado). Google Maps entra como alternativa.

const enc = (s: string) => encodeURIComponent((s ?? "").trim());

export function wazeUrl(address: string): string {
  return `https://waze.com/ul?q=${enc(address)}&navigate=yes`;
}

// Rota origem→destino no Google Maps (não usa a localização atual como partida).
export function googleMapsDirUrl(origem: string, destino: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${enc(origem)}&destination=${enc(destino)}`;
}
