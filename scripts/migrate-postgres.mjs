import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
});

const schemaPath = path.join(process.cwd(), "db", "schema.sql");
const schema = await readFile(schemaPath, "utf8");
await sql.unsafe(schema);
await sql.end();
console.log("Postgres schema migrated successfully.");
