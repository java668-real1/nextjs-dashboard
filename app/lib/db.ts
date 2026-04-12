import dns from "node:dns";
import postgres from "postgres";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

/** 本地 Docker / 内网 Postgres 通常无 TLS；Neon 等托管库需 TLS */
function resolveSsl(connectionUrl: string): boolean | "require" {
  try {
    const u = new URL(connectionUrl);
    const mode = u.searchParams.get("sslmode")?.toLowerCase();
    if (mode === "disable" || mode === "allow" || mode === "prefer") {
      return false;
    }
    if (
      mode === "require" ||
      mode === "verify-ca" ||
      mode === "verify-full"
    ) {
      return "require";
    }
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return false;
    }
    return "require";
  } catch {
    return "require";
  }
}

function client(url: string | undefined) {
  if (!url) {
    throw new Error(
      "Missing POSTGRES_URL / POSTGRES_URL_NON_POOLING (set in .env.local)",
    );
  }
  return postgres(url, {
    ssl: resolveSsl(url),
    prepare: false,
    connect_timeout: 60,
  });
}

/** 优先直连（NON_POOLING）：pooler 主机在部分网络下 TLS 握手会 ECONNRESET */
const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

export const sql = client(databaseUrl);

/** 与 `sql` 相同；保留给 seed 等显式命名场景 */
export const sqlForSchema = sql;
