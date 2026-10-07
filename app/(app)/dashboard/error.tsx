"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="empty">
      <h2>โหลดข้อมูลไม่สำเร็จ</h2>
      <button type="button" className="btn btn--primary" onClick={reset}>
        ลองอีกครั้ง
      </button>
    </div>
  );
}
