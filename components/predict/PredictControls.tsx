import Link from "next/link";
import { addDays, addYears } from "@/lib/analytics/dates";
import { MAX_AHEAD_YEARS } from "@/lib/config/weather";

const PRESETS = [
  { label: "วันนี้", days: 0 },
  { label: "พรุ่งนี้", days: 1 },
  { label: "อีก 1 สัปดาห์", days: 7 },
];

/** เลือกวันที่ใดก็ได้ตั้งแต่วันนี้จนถึง 5 ปีข้างหน้า */
export function PredictControls({ date, today }: { date: string; today: string }) {
  return (
    <div className="predict-controls">
      <form action="/dashboard" method="get" className="date-controls__form">
        <label htmlFor="date">เลือกวันที่ต้องการทำนาย</label>
        <input id="date" name="date" type="date" defaultValue={date} min={today} max={addYears(today, MAX_AHEAD_YEARS)} required />
        <button type="submit" className="btn btn--primary">
          ทำนาย
        </button>
      </form>
      <div className="presets" aria-label="ทางลัด">
        {PRESETS.map((p) => (
          <Link key={p.label} className={`btn btn--ghost${addDays(today, p.days) === date ? " btn--active" : ""}`} href={`/dashboard?date=${addDays(today, p.days)}`}>
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
