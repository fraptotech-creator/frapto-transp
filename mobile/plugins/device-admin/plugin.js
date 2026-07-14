import { registerPlugin } from "@capacitor/core";

// Plugin nativo mínimo: ativa/consulta/remove o Device Admin do app, que
// impede a desinstalação acidental enquanto estiver ativo.
export const FraptoDeviceAdmin = registerPlugin("FraptoDeviceAdmin");
