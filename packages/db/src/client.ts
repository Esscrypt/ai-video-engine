import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const queryClient = postgres(databaseUrl, {
  prepare: false,
});

export const database = drizzle(queryClient);
export const rawSqlite = queryClient;
