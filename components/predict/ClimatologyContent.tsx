import Link from "next/link";
import { RiskCard } from "@/components/dashboard/RiskCard";
import { LevelBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { analogWindows, analyzeAnalogDays, breakdownByYear, climatologyLevel, daysAheadLabel, summarizeAnalogs } from "@/lib/analytics/climatology";
import { todayBangkok } from "@/lib/analytics/dates";
import { RISK_THRESHOLDS, RULE_SEVERITY_THRESHOLD } from "@/lib/config/risk";
import { ANALOG_RADIUS_DAYS, CLIMATOLOGY_LEVELS, FORECAST_DAYS, WEATHER_ATTRIBUTION } from "@/lib/config/weather";
import { loadModelParams } from "@/lib/data/model-params";
import { formatPercent, formatThaiDate } from "@/lib/format";
import { loadAnalogHours } from "@/lib/weather/analog";
import { ForecastUnavailableError } from "@/lib/weather/open-meteo";
import { Verdict } from "./Verdict";

/** วันที่ไกลเกินพยากรณ์อากาศ: ตอบเป็นโอกาสจากสถิติอากาศช่วงเดียวกันของหลายปีที่ผ่านมา */
export async function ClimatologyContent({ date, latitude, longitude }: { date: string; latitude: number; longitude: number }) {
  const today = todayBangkok();
  const windows = analogWindows(date, today);
  let analog;
  try {
    analog = await loadAnalogHours(latitude, longitude, date, windows);
  } catch (error) {
    if (!(error instanceof ForecastUnavailableError)) throw error;
    return (
      <EmptyState
        title="ดึงข้อมูลอากาศย้อนหลังไม่สำเร็จ"
        hint={`${error.message} ลองโหลดใหม่อีกครั้งในอีกสักครู่`}
        action={
          <Link className="btn btn--primary" href={`/dashboard?date=${date}`}>
            โหลดใหม่
          </Link>
        }
      />
    );
  }

  const params = await loadModelParams();
  const days = analyzeAnalogDays(analog.hours, params, date);
  const summary = summarizeAnalogs(days);
  if (!summary) return <EmptyState title="ข้อมูลอากาศย้อนหลังไม่พอสำหรับพื้นที่นี้" hint="ลองเลือกจังหวัดอื่น" />;
  const level = climatologyLevel(summary.shareAlert);
  const perYear = breakdownByYear(days);

  return (
    <>
      <Verdict
        dateLabel={`${formatThaiDate(date)} (${daysAheadLabel(date, today)})`}
        level={level}
        source={`ประมาณจากสถิติ: ใน ${summary.n} วันเทียบเคียง (±${ANALOG_RADIUS_DAYS} วันรอบวันเดียวกันของ ${summary.years} ปีที่ผ่านมา) มี ${formatPercent(summary.shareAlert)} ที่อากาศแรงถึงเกณฑ์เตือน`}
        detail={`วันที่ไกลกว่า ${FORECAST_DAYS} วันพยากรณ์อากาศจริงไม่ได้ จึง “บอกไม่ได้ว่าวันนั้นไฟจะดับหรือไม่” บอกได้เพียงโอกาสโดยประมาณ ระดับ (ต่ำ < ${formatPercent(CLIMATOLOGY_LEVELS.moderate)} · เฝ้าระวัง ≥ ${formatPercent(CLIMATOLOGY_LEVELS.moderate)} · สูง ≥ ${formatPercent(CLIMATOLOGY_LEVELS.high)}) เป็นเกณฑ์ที่ตั้งเอง${params.synthetic ? " และโมเดลฝึกด้วยข้อมูลสังเคราะห์" : ""} ใกล้วันที่เลือกเมื่อไรให้กลับมาดู จะเปลี่ยนเป็นพยากรณ์อากาศจริง`}
      />
      {analog.loaded < analog.requested ? (
        <p className="callout">
          ดึงข้อมูลอากาศย้อนหลังได้ {analog.loaded} จาก {analog.requested} ปี (ที่เหลือดึงไม่สำเร็จ) ผลด้านล่างจึงใช้ {analog.loaded} ปี ลองโหลดหน้านี้ใหม่เพื่อให้ได้ครบ
        </p>
      ) : null}
      <div className="cards">
        <RiskCard
          wide
          title="โอกาสที่วันนั้นอากาศแรงถึงเกณฑ์เตือน"
          value={formatPercent(summary.shareAlert)}
          badge={<LevelBadge level={level} />}
          hint={`วันที่ดัชนีสภาพอากาศสูงสุด ≥ ${RULE_SEVERITY_THRESHOLD} อย่างน้อย 1 ชั่วโมง · รุนแรงมาก (≥ ${RISK_THRESHOLDS.high}) ${formatPercent(summary.shareSevere)}`}
        />
        <RiskCard
          title="ดัชนีสภาพอากาศสูงสุด"
          value={summary.meanMaxSeverity.toFixed(2)}
          hint={`ค่าเฉลี่ย · วันที่แย่ (เปอร์เซ็นไทล์ 90) ${summary.p90MaxSeverity.toFixed(2)}`}
        />
        <RiskCard
          title="การใช้ไฟของวันนั้น"
          value={`${summary.meanKwh.toFixed(1)} kWh`}
          hint={`ช่วงที่เคยเป็นได้ ${summary.kwhP10.toFixed(1)}–${summary.kwhP90.toFixed(1)} (ขนาดครัวเรือนตัวอย่าง)`}
        />
        <RiskCard
          title="อากาศโดยทั่วไป"
          value={`${summary.meanTempC.toFixed(0)}°C`}
          hint={`ฝนเฉลี่ย ${summary.meanRainMm.toFixed(1)} มม./วัน`}
        />
      </div>
      <p className="muted">
        Decision Tree ให้ความเสี่ยงสูงสุดถึงเกณฑ์เฝ้าระวังในวันเทียบเคียง {formatPercent(summary.shareModel)} (ในข้อมูลตัวอย่างโมเดลนี้ยังไม่ดีกว่ากฎ)
      </p>
      <section className="panel">
        <h2>วันเทียบเคียงรายปี</h2>
        <div className="table-scroll">
          <table className="table">
            <caption>
              ช่วง ±{ANALOG_RADIUS_DAYS} วันรอบวันที่ {date.slice(8)}/{date.slice(5, 7)} ของแต่ละปี
            </caption>
            <thead>
              <tr>
                <th>ปี (พ.ศ.)</th>
                <th>วันที่ติดเตือน</th>
                <th>วันที่แย่ที่สุด</th>
                <th>ดัชนีสูงสุด</th>
              </tr>
            </thead>
            <tbody>
              {perYear.map((y) => (
                <tr key={y.year} className={y.worstSeverity >= RISK_THRESHOLDS.high ? "table__outage" : undefined}>
                  <td>{y.year + 543}</td>
                  <td>
                    {y.alertDays} / {y.days} วัน
                  </td>
                  <td>{formatThaiDate(y.worstDate)}</td>
                  <td>{y.worstSeverity.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="muted">
        วิธีคำนวณ: ดึงอากาศรายชั่วโมงจริงของช่วงเดียวกันในอดีต แล้วรันกฎสภาพอากาศและโมเดลกับแต่ละวัน โดยใช้ประเภทวัน (วันหยุด/วันทำงาน) ของวันที่คุณเลือก ไม่ได้ปรับตามภาวะโลกร้อน · {WEATHER_ATTRIBUTION}
      </p>
    </>
  );
}
