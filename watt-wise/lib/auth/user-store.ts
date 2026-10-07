import "server-only";
import { createFileStore } from "./file-store";
import { createNeonStore } from "./neon-store";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  create(user: UserRecord): Promise<void>;
}

export class EmailTakenError extends Error {}
export class StoreNotConfiguredError extends Error {}

/**
 * เลือกที่เก็บบัญชี:
 * - มี DATABASE_URL  -> Postgres (Neon) ใช้บน Vercel ได้
 * - ไม่มี และรันในเครื่อง -> ไฟล์ data/.users.json (เฉพาะตอนพัฒนา)
 * - ไม่มี และรันบน Vercel -> ใช้ไม่ได้ (ระบบไฟล์เขียนถาวรไม่ได้) ให้แจ้งผู้ใช้
 */
export function getUserStore(): UserStore {
  const url = process.env.DATABASE_URL;
  if (url) return createNeonStore(url);
  if (process.env.VERCEL) throw new StoreNotConfiguredError("ยังไม่ได้ตั้งค่า DATABASE_URL");
  return createFileStore();
}
