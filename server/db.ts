// Barrel do acesso a dados. As funções foram divididas por domínio em server/db/*;
// este arquivo re-exporta tudo para manter `import { ... } from "./db"` funcionando.
export { getDb } from "./db/client";
export * from "./db/organizations";
export * from "./db/fleet";
export * from "./db/finance";
export * from "./db/misc";
