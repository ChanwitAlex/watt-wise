import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "สมัครสมาชิก" };

export default function RegisterPage() {
  return (
    <div className="auth__box">
      <h1>สมัครสมาชิก</h1>
      <RegisterForm />
    </div>
  );
}
