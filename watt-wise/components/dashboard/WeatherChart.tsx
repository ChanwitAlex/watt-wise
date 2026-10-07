import { linePath, linearScale, niceMax } from "@/lib/chart/scale";
export interface WeatherPoint {
  hour: number;
  windKmh: number;
  rainfallMm: number;
}

const W = 720;
const H = 240;
const M = { top: 16, right: 48, bottom: 28, left: 40 };

/** กราฟลม (เส้น, กม./ชม.) และฝน (แท่ง, มม.) ของวันที่เลือก */
export function WeatherChart({ hours }: { hours: WeatherPoint[] }) {
  const sorted = [...hours].sort((a, b) => a.hour - b.hour);
  const maxWind = niceMax(Math.max(...sorted.map((h) => h.windKmh), 1));
  const maxRain = niceMax(Math.max(...sorted.map((h) => h.rainfallMm), 1));
  const x = linearScale([0, 23], [M.left, W - M.right]);
  const yWind = linearScale([0, maxWind], [H - M.bottom, M.top]);
  const yRain = linearScale([0, maxRain], [H - M.bottom, M.top]);
  const barW = ((W - M.left - M.right) / 24) * 0.6;
  const path = linePath(sorted.map((h) => ({ x: x(h.hour), y: yWind(h.windKmh) })));

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="กราฟความเร็วลมและปริมาณฝนรายชั่วโมง">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={yWind(maxWind * t)} y2={yWind(maxWind * t)} className="chart__grid" />
            <text x={M.left - 6} y={yWind(maxWind * t) + 4} textAnchor="end" className="chart__tick">
              {Math.round(maxWind * t)}
            </text>
            <text x={W - M.right + 6} y={yRain(maxRain * t) + 4} className="chart__tick chart__tick--rain">
              {Math.round(maxRain * t)}
            </text>
          </g>
        ))}
        {sorted.map((h) => (
          <rect
            key={h.hour}
            x={x(h.hour) - barW / 2}
            y={yRain(h.rainfallMm)}
            width={barW}
            height={H - M.bottom - yRain(h.rainfallMm)}
            className="chart__bar"
          />
        ))}
        <path d={path} className="chart__line" fill="none" />
        {[0, 6, 12, 18, 23].map((h) => (
          <text key={h} x={x(h)} y={H - 8} textAnchor="middle" className="chart__tick">
            {h}:00
          </text>
        ))}
      </svg>
      <figcaption className="muted legend">
        <span className="swatch swatch--line" /> ลม (กม./ชม. แกนซ้าย) <span className="swatch swatch--bar" /> ฝน (มม. แกนขวา)
      </figcaption>
    </figure>
  );
}
