import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof createPool> | null = null;

// Cria o pool/drizzle sob demanda (local sem DB roda sem conectar).
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const poolConfig = {
        connectionLimit: 100,
        waitForConnections: true,
        queueLimit: 200,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 10000,
        // TiDB Serverless exige TLS.
        ssl: { minVersion: "TLSv1.2" as const },
      };
      _pool = createPool({ ...poolConfig, uri: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
