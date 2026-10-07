import { linePath, linearScale, niceMax } from "@/lib/chart/scale";

const W = 720;
const H = 260;
const M = { top: 16, right: 16, bottom: 28, left: 44 };

/** กราฟคาดการณ์การใช้ไฟ (kWh) รายชั่วโมงของวันที่เลือก */
export function UsageForecastChart({ points }: { points: { hour: number; kwh: number }[] }) {
  const max = niceMax(Math.max(...points.map((p) => p.kwh), 1));
  const x = linearScale([0, 23], [M.left, W - M.right]);
  const y = linearScale([0, max], [H - M.bottom, M.top]);
  const path = linePath(points.map((p) => ({ x: x(p.hour), y: y(p.kwh) })));
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="กราฟคาดการณ์การใช้ไฟฟ้ารายชั่วโมง">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(max * t)} y2={y(max * t)} className="chart__grid" />
            <text x={M.left - 6} y={y(max * t) + 4} textAnchor="end" className="chart__tick">
              {(max * t).toFixed(1)}
            </text>
          </g>
        ))}
        <path d={path} className="chart__line chart__line--forecast" fill="none" />
        {[0, 6, 12, 18, 23].map((h) => (
          <text key={h} x={x(h)} y={H - 8} textAnchor="middle" className="chart__tick">
            {h}:00
          </text>
        ))}
      </svg>
      <figcaption className="muted legend">
        <span className="swatch swatch--dash" /> คาดการณ์ (kWh/ชม.)
      </figcaption>
    </figure>
  );
}
