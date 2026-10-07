"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "กำลังดำเนินการ...",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn--${variant}`} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
