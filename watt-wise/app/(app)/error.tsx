"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="empty">
      <h2>โหลดข้อมูลไม่สำเร็จ</h2>
      <p className="muted">ลองอีกครั้ง ถ้ายังไม่ได้ให้ตรวจว่าไฟล์ในโฟลเดอร์ data/ อยู่ครบ</p>
      <button type="button" className="btn btn--primary" onClick={reset}>
        ลองอีกครั้ง
      </button>
    </div>
  );
}
