import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Parseia a URL em credenciais discretas + TLS explícito. Garante que o
// drizzle-kit push conecte no TiDB Serverless (que exige TLS), sem depender de
// como ele interpreta o `?ssl=...` da query string.
const url = new URL(connectionString);
const needsTls =
  url.searchParams.has("ssl") || url.hostname.includes("tidbcloud.com");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ...(needsTls ? { ssl: { minVersion: "TLSv1.2" as const } } : {}),
  },
});
