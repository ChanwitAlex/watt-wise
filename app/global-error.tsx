"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: "sans-serif", padding: 24, background: "#15112a", color: "#f4efff" }}>
        <div role="alert">
          <h2>ระบบขัดข้อง</h2>
          <p>เกิดข้อผิดพลาดที่ไม่คาดคิด ลองโหลดใหม่อีกครั้ง</p>
          <button onClick={reset}>ลองอีกครั้ง</button>
        </div>
      </body>
    </html>
  );
}
