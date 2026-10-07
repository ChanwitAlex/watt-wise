import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <h1>ไม่พบหน้านี้</h1>
      <p className="muted">ลิงก์อาจพิมพ์ผิดหรือหน้านี้ถูกย้ายแล้ว</p>
      <Link className="btn btn--primary" href="/dashboard">
        กลับไปแดชบอร์ด
      </Link>
    </main>
  );
}
