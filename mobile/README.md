# Frapto Transp — App de Rastreio (motorista)

App nativo **isolado** (não faz parte do sistema web) cujo único objetivo é
**rastrear a posição do motorista em segundo plano**, mesmo com o app fechado,
tela apagada ou o Waze aberto. Ele conversa só com dois endpoints do servidor:

- `POST /api/track/login` — login do motorista (usuário+senha) → devolve o token.
- `POST /api/track` — recebe a posição (autenticada pelo token).

O servidor só **grava** a posição quando o motorista tem uma viagem
**em andamento** (mesma regra do resto do sistema). Então o motorista pode
deixar o rastreio ligado o tempo todo — fora de viagem, nada é registrado.

## Como gerar o APK (na nuvem, sem Android Studio)

1. No GitHub, vá em **Actions** → **"Build APK — Rastreio (motorista)"** →
   **Run workflow**.
2. Quando terminar (verde), abra a execução e baixe o APK em **Artifacts**
   (`frapto-rastreio-apk`).
3. Envie o `app-debug.apk` para o celular do motorista e instale
   (é preciso permitir "instalar de fontes desconhecidas").
4. Ao abrir: o motorista entra com o mesmo **usuário e senha** do app do
   motorista, toca **Iniciar rastreamento** e concede a permissão de
   localização **"Permitir o tempo todo"**.

## Rodar/depurar localmente (opcional, precisa de Android Studio)

```bash
cd mobile
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android   # abre no Android Studio
```

## Observações

- APK é **debug** (autoassinado) — serve para uso interno/sideload. Para
  publicar na Play Store depois, gera-se um build **release** assinado.
- Plugin de GPS: `@transistorsoft/capacitor-background-geolocation` (Android
  gratuito). Ele roda um serviço de primeiro plano com notificação persistente
  ("Rastreamento ativo") — isso é exigência do Android para GPS em background.
