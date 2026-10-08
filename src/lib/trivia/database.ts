import "server-only";
import { Pool, type QueryResultRow } from "pg";

const globalDatabase = globalThis as unknown as { triviaPool?: Pool };

function pool(): Pool {
  const connectionString = process.env.TRIVIA_DATABASE_URL;
  if (!connectionString)
    throw new Error("Trivia database connection is not configured.");
  if (!globalDatabase.triviaPool) {
    globalDatabase.triviaPool = new Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    });
    globalDatabase.triviaPool.on("error", () => {
      console.error("Trivia database connection interrupted.");
    });
  }
  return globalDatabase.triviaPool;
}

export type DatabaseResult<T> = {
  data: T[] | null;
  error: { message: string; code?: string } | null;
};

// Use the app's project-admin role for runtime queries, rather than postgres.
// Query text is supplied only by server code; all request values are parameters.
export async function triviaQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<DatabaseResult<T>> {
  let client;
  try {
    client = await pool().connect();
    await client.query("SET ROLE project_admin");
    const result = await client.query<T>(sql, values);
    return { data: result.rows, error: null };
  } catch (error) {
    const failure = error as { message?: string; code?: string };
    return {
      data: null,
      error: {
        message: failure.message ?? "Database connection failed.",
        code: failure.code,
      },
    };
  } finally {
    client?.release();
  }
}
