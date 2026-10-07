import { toRiskLevel } from "@/lib/analytics/risk";
import type { ZoneSeries } from "@/lib/analytics/zones";

/** แผนที่ความร้อน 24 ชม. แยกโซน วาดอย่างเดียว รับข้อมูลทาง props */
export function Heatmap({ zones }: { zones: ZoneSeries[] }) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="table" aria-label="แผนที่ความร้อนดัชนีสภาพอากาศรอบตัวคุณ 24 ชั่วโมง">
        <div className="heatmap__row heatmap__row--head" role="row">
          <span className="heatmap__label" role="columnheader">
            โซน
          </span>
          {hours.map((h) => (
            <span key={h} className="heatmap__hour" role="columnheader">
              {h}
            </span>
          ))}
        </div>
        {zones.map((zone) => (
          <div className="heatmap__row" role="row" key={zone.id}>
            <span className="heatmap__label" role="rowheader">
              {zone.name}
            </span>
            {zone.values.map((v, h) => (
              <span
                key={h}
                role="cell"
                className={`heatmap__cell heatmap__cell--${v === null ? "none" : toRiskLevel(v)}`}
                style={{ opacity: v === null ? 0.3 : 0.35 + Math.min(1, v) * 0.65 }}
                title={v === null ? "ไม่มีข้อมูล" : `${zone.name} ${h}:00 ดัชนี ${v.toFixed(2)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="muted legend">
        <span className="swatch swatch--normal" /> ต่ำกว่า 0.35 <span className="swatch swatch--warning" /> 0.35–0.59{" "}
        <span className="swatch swatch--high" /> ตั้งแต่ 0.60 ·{" "}
        ดัชนีคำนวณจากพยากรณ์อากาศของแต่ละอำเภอ (ลม ฝน)
      </p>
    </div>
  );
}
