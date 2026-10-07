import "server-only";
import { neon } from "@neondatabase/serverless";
import { EmailTakenError, type UserRecord, type UserStore } from "./user-store";

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

export function createNeonStore(url: string): UserStore {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const ensureTable = () =>
    (ready ??= sql`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  return {
    async findByEmail(email) {
      await ensureTable();
      const rows = (await sql`SELECT id, email, name, password_hash FROM users WHERE email = ${email} LIMIT 1`) as UserRow[];
      const row = rows[0];
      return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash } : null;
    },
    async create(user: UserRecord) {
      await ensureTable();
      try {
        await sql`INSERT INTO users (id, email, name, password_hash)
                  VALUES (${user.id}, ${user.email}, ${user.name}, ${user.passwordHash})`;
      } catch (error) {
        if (String(error).includes("duplicate key")) throw new EmailTakenError();
        throw error;
      }
    },
  };
}
