import { RISK_THRESHOLDS } from "@/lib/config/risk";

/** แถบสเกล 0-100% พร้อมขีดเกณฑ์ 35/60 และตัวชี้ค่าปัจจุบัน */
export function RiskGauge({ value }: { value: number }) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`;
  return (
    <div className="gauge" role="img" aria-label={`ความเสี่ยง ${Math.round(value * 100)} เปอร์เซ็นต์ จากสเกล 0 ถึง 100`}>
      <div className="gauge__track">
        <span className="gauge__zone gauge__zone--normal" style={{ width: pct(RISK_THRESHOLDS.warning) }} />
        <span
          className="gauge__zone gauge__zone--warning"
          style={{ left: pct(RISK_THRESHOLDS.warning), width: pct(RISK_THRESHOLDS.high - RISK_THRESHOLDS.warning) }}
        />
        <span className="gauge__zone gauge__zone--high" style={{ left: pct(RISK_THRESHOLDS.high), right: 0 }} />
        <span className="gauge__marker" style={{ left: pct(value) }} />
      </div>
      <div className="gauge__ticks">
        <span style={{ left: 0 }}>0</span>
        <span style={{ left: pct(RISK_THRESHOLDS.warning) }}>{Math.round(RISK_THRESHOLDS.warning * 100)}</span>
        <span style={{ left: pct(RISK_THRESHOLDS.high) }}>{Math.round(RISK_THRESHOLDS.high * 100)}</span>
        <span style={{ right: 0 }}>100</span>
      </div>
    </div>
  );
}
