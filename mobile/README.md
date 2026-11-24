# Frapto Motorista — app do motorista (Android)

App nativo (Capacitor) que junta, num APK só, o que o motorista precisa:

- **Viagens**: lista as viagens dele (planejadas e em andamento), iniciar,
  concluir (com a hora de chegada) e abrir origem/destino no **Waze**.
- **GPS em segundo plano**: liga sozinho quando há viagem **em andamento** e
  desliga quando não há. Continua com a tela apagada, com o Waze aberto e
  mesmo se o motorista fechar o app (serviço em primeiro plano do Android).

As telas são **do próprio app** (não abre o site dentro dele). Ele conversa só
com a API do servidor, autenticado pelo token de rastreio no cabeçalho
`Authorization: Bearer`:

- `POST /api/track/login` — usuário + senha → token.
- `GET /api/track/viagens`, `POST /api/track/viagens/:id/iniciar`,
  `POST /api/track/viagens/:id/concluir` — mesmas regras do app web
  (`driverApp.*` no tRPC).
- `POST /api/track` — posição, enviada **direto do código nativo** pelo plugin.
- `POST /api/track/revoke` — ao sair.

## GPS: plugin gratuito

`@capgo/background-geolocation` (licença MPL-2.0, grátis). Substituiu o
Transistorsoft, que exige licença paga em build de release. Limitações
conhecidas:

- **Sem sinal, a posição daquele trecho se perde** (o envio nativo não tem
  fila). Com GPS mudo por 20+ s, usa a posição da rede do celular
  (`networkFallback`).
- Se o celular **reiniciar**, o motorista precisa abrir o app de novo.
- Xiaomi/Samsung podem matar o serviço: o app orienta a deixar a bateria em
  "Sem restrições" (e a inicialização automática, na Xiaomi).

## Como o motorista instala

O gestor manda o link pelo WhatsApp (botão no cadastro do motorista). O
download é `https://www.fraptotransp.com.br/baixar/app-motorista.apk`, que
redireciona para a Release mais recente deste repositório. No Android: tocar
em **Instalar** (na 1ª vez, permitir instalar a partir do navegador/WhatsApp).

## Como sai uma versão nova

O workflow **"Build APK — App do motorista"** roda sozinho quando algo em
`mobile/` muda na `main` (ou manualmente em Actions). Ele compila em
**release**, assina com a **chave fixa** (segredos `ANDROID_KEYSTORE_*`),
**confere a impressão digital** do certificado (falha se não for a nossa) e
publica a Release `app-motorista-v1.0.N`. O `versionCode` cresce a cada build,
então a versão nova instala **por cima** da antiga.

> A chave de assinatura fica FORA do repositório (que é público). Sem ela, as
> próximas versões não atualizam por cima — guarde o backup.

## Rodar/depurar localmente (opcional, precisa de Android Studio)

```bash
cd mobile
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
