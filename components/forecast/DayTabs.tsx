import Link from "next/link";
import type { ForecastDaySummary } from "@/lib/analytics/forecast";

function label(date: string): string {
  return new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** แท็บ 7 วัน ติดป้ายเมื่อวันนั้นมีชั่วโมงที่กฎสภาพอากาศติดเตือน */
export function DayTabs({ days, selected }: { days: ForecastDaySummary[]; selected: string }) {
  return (
    <nav className="daytabs" aria-label="เลือกวัน (พยากรณ์ล่วงหน้า)">
      {days.map((d) => (
        <Link
          key={d.date}
          href={`/dashboard?date=${d.date}`}
          className={`daytab${d.date === selected ? " daytab--active" : ""}`}
          aria-current={d.date === selected ? "date" : undefined}
        >
          <span>{label(d.date)}</span>
          <span className={`daytab__meta daytab__meta--${d.ruleLevel}`}>
            {d.alertHours > 0 ? `เตือน ${d.alertHours} ชม.` : "ปกติ"}
          </span>
        </Link>
      ))}
    </nav>
  );
}
