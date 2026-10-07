import type { Metadata } from "next";
import { demoLoginAction } from "@/lib/auth/actions";
import { LoginForm } from "@/components/auth/AuthForms";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Bolt } from "@/components/ui/Bolt";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

// อ่าน DEMO_ENABLED ตอนรัน ไม่ใช่ตอน build
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const demoEnabled = process.env.DEMO_ENABLED !== "false";
  return (
    <div className="auth__box">
      <h1>
        <Bolt /> Watt Wise
      </h1>
      <p className="muted">วิเคราะห์ความเสี่ยงไฟดับและการใช้ไฟฟ้า (ต้นแบบเพื่อการเรียนรู้)</p>
      <LoginForm />
      {demoEnabled ? (
        <form action={demoLoginAction} className="auth__demo">
          <p className="muted">ผู้ตรวจหรืออาจารย์ดูได้เลยโดยไม่ต้องสมัคร</p>
          <SubmitButton variant="ghost" pendingText="กำลังเข้าสู่โหมดทดลอง...">
            ทดลองใช้โดยไม่ต้องสมัคร
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
