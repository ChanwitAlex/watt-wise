"use client";

import { useEffect, useState } from "react";
import type { RuleAlert } from "@/lib/analytics/advice";
import { formatHour, formatThaiDate } from "@/lib/format";
import { Tag } from "@/components/ui/Badge";

const STORAGE_KEY = "watt-wise:acknowledged-alerts";

/** รายการแจ้งเตือนตามกฎ พร้อมปุ่มรับทราบ (เก็บในเบราว์เซอร์นี้เท่านั้น) */
export function AlertList({ alerts, scope = "" }: { alerts: RuleAlert[]; scope?: string }) {
  const [acked, setAcked] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setAcked(JSON.parse(saved) as string[]);
    } catch {
      /* อ่านไม่ได้ก็เริ่มจากว่าง */
    }
  }, []);

  function acknowledge(id: string) {
    const next = [...acked, id];
    setAcked(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* เก็บไม่ได้ก็ข้าม */
    }
  }

  return (
    <ul className="alerts">
      {alerts.map((a) => {
        const id = `${scope}|${a.timestamp}`;
        const done = acked.includes(id);
        return (
          <li key={id} className={`alert${done ? " alert--done" : ""}`}>
            <div>
              <p className="alert__when">
                {formatThaiDate(a.date)} {formatHour(a.hour)} <Tag tone="alert">ตามกฎ</Tag>
              </p>
              <p className="muted">
                ลม {a.windKmh.toFixed(1)} กม./ชม. · ฝน {a.rainfallMm.toFixed(1)} มม. · ดัชนี {a.severity.toFixed(2)}
              </p>
              <p>{a.advice}</p>
            </div>
            <button type="button" className="btn btn--ghost" disabled={done} onClick={() => acknowledge(id)}>
              {done ? "รับทราบแล้ว" : "รับทราบ"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
