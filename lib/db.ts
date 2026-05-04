import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;
type QueryRow = Record<string, unknown>;

let sqlClient: SqlClient | null = null;

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super("DATABASE_URL is not configured.");
  }
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new MissingDatabaseUrlError();
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
}

export function rowsOf(result: Awaited<ReturnType<SqlClient>>): QueryRow[] {
  return Array.isArray(result) ? (result as QueryRow[]) : [];
}

export async function ensureProfile(user: {
  id: string;
  email?: string | null;
  nickname?: string | null;
}) {
  const sql = getSql();
  const rows = rowsOf(await sql`
    insert into profiles (user_id, email, nickname)
    values (${user.id}, ${user.email || null}, ${user.nickname || null})
    on conflict (user_id) do update
      set email = excluded.email,
          updated_at = now()
    returning user_id, email, nickname, created_at, updated_at
  `);

  return rows[0];
}
