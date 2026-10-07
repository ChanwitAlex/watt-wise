"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/config/site";
import { SubmitButton } from "@/components/ui/SubmitButton";

const INITIAL: FormState = { error: null };

export function LoginForm() {
  const [state, action] = useActionState(loginAction, INITIAL);
  return (
    <form action={action} className="form">
      <label htmlFor="email">อีเมล</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">รหัสผ่าน</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {state.error ? (
        <p role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingText="กำลังเข้าสู่ระบบ...">เข้าสู่ระบบ</SubmitButton>
      <p className="muted">
        ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, INITIAL);
  return (
    <form action={action} className="form">
      <label htmlFor="name">ชื่อที่แสดง</label>
      <input id="name" name="name" type="text" autoComplete="name" required minLength={2} />
      <label htmlFor="email">อีเมล</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">รหัสผ่าน (อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร)</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} />
      {state.error ? (
        <p role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingText="กำลังสมัคร...">สมัครสมาชิก</SubmitButton>
      <p className="muted">
        มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
      </p>
    </form>
  );
}
