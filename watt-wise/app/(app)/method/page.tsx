import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PageHeader } from "@/components/ui/PageHeader";
import { RISK_THRESHOLDS, RULE_SEVERITY_THRESHOLD } from "@/lib/config/risk";
import { FORECAST_DAYS } from "@/lib/config/weather";
import { loadModelParams } from "@/lib/data/model-params";

export const metadata: Metadata = { title: "วิธีคำนวณ" };

interface Row { id: string; auc?: number; f1?: number; mae?: number }
interface Results {
  data: { rows: number; outages_total: number; outages_test: number; period: [string, string] };
  outage: { classification: { rows: Row[]; tree_depth: number }; duration: { rows: Row[] } };
}

async function loadResults(): Promise<Results> {
  return JSON.parse(await readFile(path.join(process.cwd(), "data", "model_results.json"), "utf-8")) as Results;
}

export default async function MethodPage() {
  const [params, results] = await Promise.all([loadModelParams(), loadResults()]);
  const cls = results.outage.classification.rows;
  const rule = cls.find((r) => r.id === "rule_based");
  const tree = cls.find((r) => r.id === "decision_tree");
  const dur = results.outage.duration.rows;
  const median = dur.find((r) => r.id === "median");
  const lin = dur.find((r) => r.id === "linear_regression");
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <>
      <PageHeader title="วิธีคำนวณโอกาสไฟดับและระยะเวลา" />

      <section className="panel">
        <h2>ที่มาของข้อมูล</h2>
        <p>
          {params.synthetic
            ? `โมเดลเทรนด้วยข้อมูลจำลอง ${results.data.rows.toLocaleString("th-TH")} แถวรายชั่วโมง (${results.data.period[0].slice(0, 10)} ถึง ${results.data.period[1].slice(0, 10)}) ที่สร้างด้วยสคริปต์ตามลักษณะอากาศของภาคอีสาน ไม่ใช่สถิติไฟดับจริงของการไฟฟ้า ผลความแม่นยำจึงวัดกับข้อมูลที่ตั้งขึ้นเอง ไม่ได้บอกว่าจะแม่นกับไฟดับจริง`
            : `โมเดลเทรนด้วยบันทึกไฟดับที่เก็บไว้ ${results.data.rows.toLocaleString("th-TH")} แถวรายชั่วโมง`}
        </p>
        <p className="muted">ข้อมูลอากาศที่ใช้ทำนายมาจากพยากรณ์รายชั่วโมงของ Open-Meteo ตามพื้นที่ที่เลือก</p>
      </section>

      <section className="panel">
        <h2>โอกาสไฟดับ: ใช้สองตัวคู่กัน แล้วเอาระดับที่สูงกว่า</h2>
        <ol>
          <li>
            <strong>กฎดัชนีสภาพอากาศ</strong> ดัชนีรายชั่วโมง ≈ ลม (กม./ชม.) ÷ 120 + ฝน (มม.) ÷ 80 ใช้ค่าสูงสุดของวัน
            ต่ำกว่า {RISK_THRESHOLDS.warning} = ปกติ · ตั้งแต่ {RISK_THRESHOLDS.warning} = เฝ้าระวัง · ตั้งแต่ {RISK_THRESHOLDS.high} = เสี่ยงสูง
            (ชั่วโมงที่ดัชนี ≥ {RULE_SEVERITY_THRESHOLD} นับเป็น “ติดเตือน”)
          </li>
          <li>
            <strong>Decision Tree (ลึก {results.outage.classification.tree_depth} ชั้น)</strong> รับ ชั่วโมง วันหยุด ลม ลมกระโชก และฝน
            ของแต่ละชั่วโมง แล้วตอบเป็นความน่าจะเป็นไฟดับ ใช้ค่าสูงสุดของวัน แปลงเป็นระดับด้วยเกณฑ์ {pct(RISK_THRESHOLDS.warning)} และ {pct(RISK_THRESHOLDS.high)}
          </li>
        </ol>
        <p>
          ระดับที่แสดงคือระดับที่สูงกว่าระหว่างสองตัว เป็นการประเมินจากสภาพอากาศ <strong>ไม่ใช่การยืนยันว่าไฟจะดับ</strong> เกณฑ์ทั้งหมดเป็นค่าที่ผู้พัฒนาตั้งเอง
        </p>
        {rule && tree ? (
          <p className="muted">
            ผลทดสอบ (ชุดทดสอบ {results.data.outages_test} เหตุการณ์): กฎ AUC {rule.auc?.toFixed(2)} F1 {rule.f1?.toFixed(2)} · Decision Tree AUC {tree.auc?.toFixed(2)} F1 {tree.f1?.toFixed(2)}
            ต้นไม้ไม่ได้ดีกว่ากฎอย่างชัดเจน จึงใช้ทั้งสองตัวร่วมกัน
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2>ระยะเวลาไฟดับ (นาที)</h2>
        <p>
          ใช้ Linear Regression จากชั่วโมง ลม ลมกระโชก และฝน คำนวณเป็น “ถ้าเกิดไฟดับ จะดับนานประมาณกี่นาที” ที่ชั่วโมงเสี่ยงสุดของวัน ไม่ได้บอกว่าไฟจะดับจริง
        </p>
        {median && lin ? (
          <p className="muted">
            ทดสอบด้วย leave-one-out: คลาดเคลื่อนเฉลี่ย {lin.mae?.toFixed(1)} นาที เทียบกับการเดาด้วยค่ากลาง {median.mae?.toFixed(1)} นาที
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2>วันที่ไกลกว่า {FORECAST_DAYS} วัน</h2>
        <p>
          ไม่มีพยากรณ์อากาศจริง จึงใช้สถิติอากาศรายชั่วโมงของวันเดียวกัน (±7 วัน) ย้อนหลังสูงสุด 10 ปี นำกฎและโมเดลไปรันกับทุกวันเทียบเคียง
          แล้วรายงานสัดส่วนวันที่อากาศแรงถึงเกณฑ์เตือน บอกไม่ได้ว่าวันนั้นไฟจะดับหรือไม่
        </p>
      </section>

      <p className="muted">
        <Link href="/dashboard">กลับแดชบอร์ด</Link>
      </p>
    </>
  );
}
