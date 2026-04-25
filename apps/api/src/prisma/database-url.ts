type NormalizeDatabaseUrlOptions = {
  defaultConnectionLimit?: number;
  defaultPoolTimeoutSeconds?: number;
};

function parsePositiveInt(raw: string | undefined) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

export function normalizeDatabaseUrl(databaseUrl: string | undefined, options: NormalizeDatabaseUrlOptions = {}) {
  if (!databaseUrl) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isSupabasePooler = hostname.endsWith("pooler.supabase.com");

  const requestedConnectionLimit =
    parsePositiveInt(process.env.PRISMA_CONNECTION_LIMIT) ??
    (isSupabasePooler ? options.defaultConnectionLimit ?? null : null);
  const requestedPoolTimeout =
    parsePositiveInt(process.env.PRISMA_POOL_TIMEOUT_SECONDS) ??
    (isSupabasePooler ? options.defaultPoolTimeoutSeconds ?? null : null);

  if (requestedConnectionLimit && !parsed.searchParams.has("connection_limit")) {
    parsed.searchParams.set("connection_limit", String(requestedConnectionLimit));
  }

  if (requestedPoolTimeout && !parsed.searchParams.has("pool_timeout")) {
    parsed.searchParams.set("pool_timeout", String(requestedPoolTimeout));
  }

  return parsed.toString();
}
