import type { RiskLevel } from "@/lib/analytics/risk";

const WORDING: Record<RiskLevel, string> = {
  normal: "ต่ำ",
  warning: "เฝ้าระวัง (มีโอกาส)",
  high: "สูง",
};

/** คำตอบตรง ๆ ว่าวันที่เลือกมีโอกาสไฟดับระดับไหน พร้อมคำอธิบายว่าคำตอบนี้มาจากอะไร */
export function Verdict({ dateLabel, level, source, detail }: { dateLabel: string; level: RiskLevel; source: string; detail?: string }) {
  return (
    <section className={`verdict verdict--${level}`} aria-live="polite">
      <p className="verdict__q">{dateLabel} ไฟมีโอกาสดับไหม?</p>
      <p className="verdict__a">
        โอกาสไฟดับ: <strong>{WORDING[level]}</strong>
      </p>
      <p className="verdict__src">{source}</p>
      {detail ? <p className="muted">{detail}</p> : null}
    </section>
  );
}
