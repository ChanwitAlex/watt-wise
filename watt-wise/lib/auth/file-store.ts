import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EmailTakenError, type UserRecord, type UserStore } from "./user-store";

const FILE = path.join(process.cwd(), "data", ".users.json");

async function readAll(): Promise<UserRecord[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf-8")) as UserRecord[];
  } catch {
    return [];
  }
}

/** ที่เก็บบัญชีแบบไฟล์ สำหรับพัฒนาในเครื่องเท่านั้น (บน Vercel เขียนไฟล์ถาวรไม่ได้) */
export function createFileStore(): UserStore {
  return {
    async findByEmail(email) {
      return (await readAll()).find((u) => u.email === email) ?? null;
    },
    async create(user) {
      const users = await readAll();
      if (users.some((u) => u.email === user.email)) throw new EmailTakenError();
      users.push(user);
      await mkdir(path.dirname(FILE), { recursive: true });
      await writeFile(FILE, JSON.stringify(users, null, 2), "utf-8");
    },
  };
}
