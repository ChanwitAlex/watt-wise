import { SignJWT, jwtVerify } from "jose";
import { SESSION_MAX_AGE_SEC } from "@/lib/config/site";

export interface SessionPayload {
  userId: string;
  name: string;
  demo: boolean;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ต้องตั้ง SESSION_SECRET (อย่างน้อย 32 ตัวอักษร) ใน Environment Variables");
    }
    return new TextEncoder().encode("dev-only-secret-do-not-use-in-production!!");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, demo: payload.demo })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

/** คืน null ถ้า token ไม่ถูกต้อง/หมดอายุ (ใช้ได้ทั้งใน middleware และ server) */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { userId: payload.sub, name: String(payload.name ?? ""), demo: payload.demo === true };
  } catch {
    return null;
  }
}
