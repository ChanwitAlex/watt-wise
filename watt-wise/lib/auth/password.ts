import "server-only";
import bcrypt from "bcryptjs";

const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** ใช้เทียบเวลาตอนไม่พบอีเมล เพื่อไม่ให้เดาได้ว่าอีเมลนี้มีในระบบหรือไม่ */
export const DUMMY_HASH = "$2a$10$cFPuF2o/2qoY0Z0vzR2tn.XU5MlV6BbjtEVkQuYLuCLyB.Oo7bkCq";
