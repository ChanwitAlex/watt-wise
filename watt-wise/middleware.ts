import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session-token";
import { SESSION_COOKIE } from "@/lib/config/site";

const AUTH_PAGES = ["/login", "/register"];

/** จุดเดียวที่ตัดสินเรื่อง redirect ไปหน้าล็อกอิน (หน้าอื่นไม่ต้องเช็กซ้ำ) */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p);

  if (!session && !isAuthPage) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isAuthPage) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
