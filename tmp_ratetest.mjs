const BASE = "https://frapto-transp-production.up.railway.app";
const token = "ratelimit_probe_token_xyz";
const N = 250;
const codes = {};
let first429 = -1;
for (let i = 0; i < N; i++) {
  const r = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, lat: -20, lng: -40 }),
  });
  codes[r.status] = (codes[r.status] || 0) + 1;
  if (r.status === 429 && first429 < 0) first429 = i + 1;
}
console.log("distribuição de status:", JSON.stringify(codes));
console.log("primeiro 429 na requisição nº:", first429);
